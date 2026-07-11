/**
 * Ingestion: ClinicalTrials.gov API v2 -> TrialRecord.
 *
 * Fetches a study record from the live ClinicalTrials.gov v2 API and distills it
 * into the shared `TrialRecord` contract. Parsing lives here; the shape it
 * produces is owned by `@/lib/contract` (read-only to this file).
 */

import {
  TrialRecordSchema,
  type TrialRecord,
  type RegisteredOutcome,
  type PublicationRef,
} from "@/lib/contract";

const UA = "outcome-guard/0.1 (research audit tool)";
const BASE = "https://clinicaltrials.gov/api/v2/studies";

/** Minimal view of the v2 study JSON we actually read. Everything is optional
 *  because the API omits empty modules/buckets entirely. */
interface CtgOutcome {
  measure?: string;
  description?: string;
  timeFrame?: string;
}
interface CtgReference {
  pmid?: string;
  type?: string;
  citation?: string;
}
interface CtgStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string; officialTitle?: string };
    statusModule?: { overallStatus?: string };
    outcomesModule?: {
      primaryOutcomes?: CtgOutcome[];
      secondaryOutcomes?: CtgOutcome[];
      otherOutcomes?: CtgOutcome[];
    };
    referencesModule?: { references?: CtgReference[] };
  };
}

function mapOutcomes(
  raw: CtgOutcome[] | undefined,
  type: RegisteredOutcome["type"],
  sourceType: NonNullable<RegisteredOutcome["sourceType"]>,
): RegisteredOutcome[] {
  if (!raw) return [];
  return raw
    .filter((o): o is CtgOutcome & { measure: string } => Boolean(o.measure))
    .map((o) => ({
      measure: o.measure,
      description: o.description || undefined,
      timeFrame: o.timeFrame || undefined,
      type,
      sourceType,
    }));
}

/**
 * Fetch a trial by NCT id and return it as a validated `TrialRecord`.
 *
 * - `primaryOutcomes` -> type "primary".
 * - `secondaryOutcomes` and `otherOutcomes` -> type "secondary"
 *   (the raw registry bucket is preserved in `sourceType`).
 * - References of type "RESULT" become `resultPublicationRefs`; if the registry
 *   lists no RESULT references, "DERIVED" references are included as a fallback.
 *
 * Throws on non-200 responses and on any data that fails the contract schema.
 */
export async function getTrial(nctId: string): Promise<TrialRecord> {
  const url = `${BASE}/${encodeURIComponent(nctId)}?format=json`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 500);
    throw new Error(
      `ClinicalTrials.gov request failed for ${nctId}: ${res.status} ${res.statusText} — ${body}`,
    );
  }

  const study = (await res.json()) as CtgStudy;
  const ps = study.protocolSection ?? {};

  const registeredOutcomes: RegisteredOutcome[] = [
    ...mapOutcomes(ps.outcomesModule?.primaryOutcomes, "primary", "primary"),
    ...mapOutcomes(ps.outcomesModule?.secondaryOutcomes, "secondary", "secondary"),
    ...mapOutcomes(ps.outcomesModule?.otherOutcomes, "secondary", "other"),
  ];

  const refs = ps.referencesModule?.references ?? [];
  const toRef = (r: CtgReference): PublicationRef => ({
    citation: r.citation && r.citation.trim().length > 0 ? r.citation : `PMID:${r.pmid ?? "unknown"}`,
    pmid: r.pmid || undefined,
    url: r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : undefined,
  });
  const results = refs.filter((r) => r.type === "RESULT");
  const derived = refs.filter((r) => r.type === "DERIVED");
  const resultPublicationRefs = (results.length > 0 ? results : derived).map(toRef);

  const record: TrialRecord = {
    nctId: ps.identificationModule?.nctId ?? nctId,
    title:
      ps.identificationModule?.briefTitle ||
      ps.identificationModule?.officialTitle ||
      nctId,
    status: ps.statusModule?.overallStatus ?? "UNKNOWN",
    registeredOutcomes,
    resultPublicationRefs,
  };

  // Validate against the shared contract so bad/unexpected data fails loudly.
  return TrialRecordSchema.parse(record);
}
