/**
 * Ingestion: Europe PMC -> results-paper text.
 *
 * Resolves a trial's results publication to plain text (Methods + Results when
 * full text is available, else the abstract). No LLM involved — this is pure
 * fetch + XML/text reduction.
 */

const UA = "outcome-guard/0.1 (research audit tool)";
const REST = "https://www.ebi.ac.uk/europepmc/webservices/rest";

export interface PaperText {
  text: string;
  /** Human-readable provenance, e.g. "Europe PMC fullTextXML (MED/25056511)". */
  source: string;
  section: "fulltext" | "abstract";
}

interface EpmcSearchResult {
  id?: string;
  source?: string;
  pmid?: string;
  pmcid?: string;
  title?: string;
  abstractText?: string;
  hasTextMinedTerms?: string;
}
interface EpmcSearchResponse {
  hitCount?: number;
  resultList?: { result?: EpmcSearchResult[] };
}

async function epmcFetch(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept } });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 500);
    throw new Error(
      `Europe PMC request failed: ${res.status} ${res.statusText} for ${url} — ${body}`,
    );
  }
  return res;
}

async function search(query: string): Promise<EpmcSearchResult[]> {
  const url = `${REST}/search?query=${encodeURIComponent(query)}&format=json&pageSize=25&resultType=core`;
  const res = await epmcFetch(url, "application/json");
  const json = (await res.json()) as EpmcSearchResponse;
  return json.resultList?.result ?? [];
}

/** Strip XML/HTML tags and collapse whitespace to readable plain text. */
function xmlToPlainText(xml: string): string {
  return xml
    .replace(/<xref[^>]*>[^<]*<\/xref>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Reduce a JATS full-text XML string to just the Methods + Results sections.
 * Matches top-level (and nested) `<sec>` blocks whose `<title>` looks like
 * methods or results. Falls back to the whole body if none match.
 */
function reduceToMethodsResults(xml: string): string {
  const secRegex = /<sec\b[^>]*>([\s\S]*?)<\/sec>/gi;
  const wanted = /(method|material|patients and|results|findings|outcome)/i;
  const chunks: string[] = [];

  let m: RegExpExecArray | null;
  while ((m = secRegex.exec(xml)) !== null) {
    const sec = m[1];
    const titleMatch = sec.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? xmlToPlainText(titleMatch[1]) : "";
    if (wanted.test(title)) {
      chunks.push(`## ${title}\n${xmlToPlainText(sec)}`);
    }
  }

  if (chunks.length > 0) return chunks.join("\n\n");

  // No labelled sections matched: fall back to the whole <body>, else all text.
  const body = xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return xmlToPlainText(body ? body[1] : xml);
}

async function tryFullText(source: string, id: string): Promise<string | null> {
  const url = `${REST}/${source}/${id}/fullTextXML`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/xml" } });
    if (!res.ok) return null;
    const xml = await res.text();
    if (!xml || xml.length < 200) return null;
    const reduced = reduceToMethodsResults(xml);
    return reduced.length > 0 ? reduced : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a results paper to text.
 *
 * Resolution order:
 *  1. If `pmid` is given, try the Europe PMC full-text XML (source MED).
 *  2. Otherwise search by `nctId`, then by `title`, to find a PMID/PMCID.
 *  3. Try full text (PMC preferred, then MED); reduce to Methods + Results.
 *  4. Fall back to the abstract from the search record.
 *
 * The returned `section` reports which path produced the text.
 */
export async function getPaperText(opts: {
  pmid?: string;
  nctId?: string;
  title?: string;
}): Promise<PaperText> {
  const { pmid, nctId, title } = opts;

  // 1. Direct PMID full text.
  if (pmid) {
    const full = await tryFullText("MED", pmid);
    if (full) {
      return { text: full, source: `Europe PMC fullTextXML (MED/${pmid})`, section: "fulltext" };
    }
  }

  // 2. Locate a record via search.
  let record: EpmcSearchResult | undefined;
  if (pmid) {
    record = (await search(`EXT_ID:${pmid} AND SRC:MED`))[0];
  }
  if (!record && nctId) {
    const hits = await search(nctId);
    // Prefer records that actually have full text mined content when present.
    record = hits.find((r) => r.pmcid) ?? hits[0];
  }
  if (!record && title) {
    const hits = await search(`TITLE:"${title.replace(/"/g, "")}"`);
    record = hits.find((r) => r.pmcid) ?? hits[0];
  }

  // 3. Try full text on the located record (PMC first, then MED).
  if (record) {
    if (record.pmcid) {
      const full = await tryFullText("PMC", record.pmcid);
      if (full) {
        return {
          text: full,
          source: `Europe PMC fullTextXML (PMC/${record.pmcid})`,
          section: "fulltext",
        };
      }
    }
    const medId = record.pmid ?? (record.source === "MED" ? record.id : undefined);
    if (medId) {
      const full = await tryFullText("MED", medId);
      if (full) {
        return {
          text: full,
          source: `Europe PMC fullTextXML (MED/${medId})`,
          section: "fulltext",
        };
      }
    }

    // 4. Abstract fallback.
    if (record.abstractText) {
      const abstract = xmlToPlainText(record.abstractText);
      const label = record.pmid ?? record.pmcid ?? record.id ?? "unknown";
      return {
        text: abstract,
        source: `Europe PMC abstract (${record.source ?? "?"}/${label})`,
        section: "abstract",
      };
    }
  }

  const desc = pmid ? `pmid=${pmid}` : nctId ? `nctId=${nctId}` : `title=${title ?? "?"}`;
  throw new Error(`Europe PMC: could not resolve any paper text for ${desc}`);
}
