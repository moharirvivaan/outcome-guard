import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AuditResultSchema,
  type AuditEvent,
  type AuditRequest,
  type AuditResult,
  type PaperEvent,
  type RegisteredOutcome,
} from "@/lib/contract";
import { getTrial } from "@/lib/ingest/clinicaltrials";
import { getPaperText } from "@/lib/ingest/europepmc";
import { pdfToText } from "@/lib/ingest/pdf";
import { extractReported, type PaperInput } from "@/lib/engine/extractReported";
import { matchOutcomes } from "@/lib/engine/matchOutcomes";
import { computeIntegrityScore, scoreBreakdown } from "@/lib/report/score";

/**
 * POST /api/audit  — live, streamed outcome-switching audit.
 *
 * Body: { nctId, paperSource?, pdfBase64? } (see AuditRequest).
 * Response: a stream of newline-delimited JSON `AuditEvent`s so the client can
 * render the audit as it happens (registry → paper → extract → per-match → score
 * → done). Any failure ends the stream with a single `error` event.
 *
 * The Anthropic key is read server-side from ANTHROPIC_API_KEY and never leaves
 * this route. This runs on the Node.js runtime (fs + the AI SDK need it).
 */
export const runtime = "nodejs";
// The audit performs several sequential LLM calls; give it room.
export const maxDuration = 300;

const DEMO_NCT = "NCT01951625";
const DEMO_PAPER_FIXTURE = "paper.NCT01951625.json";

/** The paper fixture on disk mirrors PaperInput's structured-sections form. */
interface PaperFixture {
  source?: { path?: string };
  sections: { section: string; text: string }[];
}

async function loadDemoPaperFixture(): Promise<{
  paper: PaperInput;
  meta: PaperEvent["meta"];
}> {
  const file = path.join(process.cwd(), "fixtures", DEMO_PAPER_FIXTURE);
  const raw = await readFile(file, "utf8");
  const fixture = JSON.parse(raw) as PaperFixture;
  const chars = fixture.sections.reduce((n, s) => n + s.text.length, 0);
  return {
    paper: { sections: fixture.sections },
    meta: {
      source: `fixture: ${DEMO_PAPER_FIXTURE}`,
      origin: "fixture",
      section: "fixture",
      chars,
    },
  };
}

/** Turn the trial's registeredOutcomes into the engine's input array (identity). */
function registeredFor(outcomes: RegisteredOutcome[]): RegisteredOutcome[] {
  return outcomes;
}

/**
 * Drive the whole pipeline, pushing an AuditEvent for each stage into `emit`.
 * Throws on failure; the caller converts that into an `error` event.
 */
async function runAudit(
  body: AuditRequest,
  emit: (event: AuditEvent) => void,
): Promise<void> {
  const nctId = body.nctId.trim().toUpperCase();
  if (!/^NCT\d{8}$/.test(nctId)) {
    emit({ stage: "error", message: `Not a valid NCT id: "${body.nctId}"` });
    return;
  }

  // 1. Registry ---------------------------------------------------------------
  let trial;
  try {
    trial = await getTrial(nctId);
  } catch (err) {
    emit({
      stage: "error",
      failedStage: "registry",
      message: `Could not fetch the trial registry for ${nctId}: ${errMessage(err)}`,
    });
    return;
  }
  emit({ stage: "registry", trial });

  if (trial.registeredOutcomes.length === 0) {
    emit({
      stage: "error",
      failedStage: "registry",
      message: `${nctId} has no registered outcomes on ClinicalTrials.gov, so there is nothing to audit against.`,
    });
    return;
  }

  // 2. Resolve paper text -----------------------------------------------------
  // Default: fixture for the demo trial (reliable, offline-safe), Europe PMC
  // otherwise. `paperSource` overrides the default.
  const paperSource =
    body.paperSource ?? (nctId === DEMO_NCT ? "fixture" : "europepmc");

  let paper: PaperInput;
  let paperMeta: PaperEvent["meta"];
  try {
    if (paperSource === "fixture") {
      if (nctId !== DEMO_NCT) {
        throw new Error(
          `paperSource "fixture" is only available for the demo trial ${DEMO_NCT}`,
        );
      }
      const demo = await loadDemoPaperFixture();
      paper = demo.paper;
      paperMeta = demo.meta;
    } else if (paperSource === "pdf") {
      if (!body.pdfBase64) {
        throw new Error(`paperSource "pdf" requires a base64-encoded pdfBase64`);
      }
      const bytes = Buffer.from(body.pdfBase64, "base64");
      const text = await pdfToText(bytes);
      paper = text;
      paperMeta = {
        source: "uploaded PDF",
        origin: "pdf",
        section: "fulltext",
        chars: text.length,
      };
    } else {
      // Europe PMC. Prefer a registry-supplied PMID, else search by id/title.
      const pmid = trial.resultPublicationRefs.find((r) => r.pmid)?.pmid;
      const resolved = await getPaperText({
        pmid,
        nctId,
        title: trial.title,
      });
      paper = resolved.text;
      paperMeta = {
        source: resolved.source,
        origin: "europepmc",
        section: resolved.section,
        chars: resolved.text.length,
      };
    }
  } catch (err) {
    emit({
      stage: "error",
      failedStage: "paper",
      message: `Could not resolve a results paper for ${nctId}: ${errMessage(err)}. No linked open-access publication was found.`,
    });
    return;
  }

  if (paperMeta.chars < 50) {
    emit({
      stage: "error",
      failedStage: "paper",
      message: `The resolved paper text for ${nctId} was empty or too short to audit.`,
    });
    return;
  }
  emit({ stage: "paper", meta: paperMeta });

  // 3. Extract reported outcomes (Sonnet) ------------------------------------
  emit({ stage: "extracting" });
  let reportedOutcomes;
  try {
    reportedOutcomes = await extractReported(paper);
  } catch (err) {
    emit({
      stage: "error",
      failedStage: "extracting",
      message: `Outcome extraction failed: ${errMessage(err)}`,
    });
    return;
  }
  if (reportedOutcomes.length === 0) {
    emit({
      stage: "error",
      failedStage: "extracting",
      message: `No reported outcomes could be extracted from the ${nctId} paper text.`,
    });
    return;
  }
  emit({ stage: "reported", reportedOutcomes });

  // 4. Match registered vs reported (Opus) -----------------------------------
  emit({ stage: "matching" });
  let matches;
  try {
    matches = await matchOutcomes(registeredFor(trial.registeredOutcomes), reportedOutcomes);
  } catch (err) {
    emit({
      stage: "error",
      failedStage: "matching",
      message: `Outcome matching failed: ${errMessage(err)}`,
    });
    return;
  }

  // Stream each match individually so the ledger animates row-by-row. (The
  // matcher resolves all matches in one call; we fan them out as events.)
  matches.forEach((match, i) => {
    emit({ stage: "match", match, index: i + 1, total: matches.length });
  });

  // 5. Assemble + score -------------------------------------------------------
  const draft: AuditResult = {
    trialRecord: trial,
    reportedOutcomes,
    matches,
    integrityScore: 0, // filled next
    metadata: {
      registrySource: "clinicaltrials.gov/api/v2",
      paperSource: paperMeta.source,
      model: "extract: claude-sonnet-5; match: claude-opus-4-8",
      notes:
        "Live audit. Classifications are a reviewer aid backed by verbatim quotes, not a verdict.",
    },
  };
  const integrityScore = computeIntegrityScore(draft);
  const breakdown = scoreBreakdown(draft);
  draft.integrityScore = integrityScore;
  emit({ stage: "scored", integrityScore, scoreBreakdown: breakdown });

  // Validate the final result against the contract before the terminal event.
  let auditResult: AuditResult;
  try {
    auditResult = AuditResultSchema.parse(draft);
  } catch (err) {
    emit({
      stage: "error",
      failedStage: "scored",
      message: `Assembled audit failed contract validation: ${errMessage(err)}`,
    });
    return;
  }
  emit({ stage: "done", auditResult });
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function POST(request: Request): Promise<Response> {
  let body: AuditRequest;
  try {
    body = (await request.json()) as AuditRequest;
  } catch {
    return jsonError("Request body must be JSON: { nctId }");
  }
  if (!body || typeof body.nctId !== "string" || body.nctId.length === 0) {
    return jsonError("Missing required field: nctId");
  }

  // Guard the key here so the UI gets a clean, specific message rather than a
  // raw SDK auth error mid-stream.
  if (!process.env.ANTHROPIC_API_KEY) {
    return streamSingleError(
      "Server is missing ANTHROPIC_API_KEY — live auditing is unavailable. Use the offline demo instead.",
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AuditEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await runAudit(body, emit);
      } catch (err) {
        // Last-resort catch so the stream always closes with an error event.
        emit({ stage: "error", message: errMessage(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** A one-line NDJSON error stream (used for pre-flight failures like a missing key). */
function streamSingleError(message: string): Response {
  const event: AuditEvent = { stage: "error", message };
  return new Response(JSON.stringify(event) + "\n", {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function jsonError(message: string): Response {
  return new Response(JSON.stringify({ stage: "error", message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
