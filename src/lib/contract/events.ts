import type { AuditResult } from "./audit";
import type { ReportedOutcome } from "./outcomes";
import type { OutcomeMatch } from "./match";
import type { TrialRecord } from "./trial";
import type { ScoreBreakdownLike } from "./score-shape";

/**
 * Streaming audit protocol.
 *
 * The `/api/audit` route emits a sequence of these events as newline-delimited
 * JSON (one JSON object per line) so the UI can render progress live — the
 * registry lands, then the paper, then reported outcomes, then one `match`
 * event per resolved OutcomeMatch (rows stream into the ledger), then the score,
 * then the assembled AuditResult.
 *
 * This is part of the shared contract: both the server route and the client
 * consumer are typed against `AuditEvent`, so the wire format cannot drift.
 */
export type AuditStage =
  | "registry"
  | "paper"
  | "extracting"
  | "reported"
  | "matching"
  | "match"
  | "scored"
  | "done"
  | "error";

/** After `getTrial(nctId)` resolves the registry record. */
export interface RegistryEvent {
  stage: "registry";
  trial: TrialRecord;
}

/** After the results-paper text is resolved (fixture / Europe PMC / PDF). */
export interface PaperEvent {
  stage: "paper";
  meta: {
    /** Human-readable provenance, e.g. "fixture: paper.NCT01951625.json". */
    source: string;
    /** Where the text came from. */
    origin: "fixture" | "europepmc" | "pdf";
    /** Whether it is full text or an abstract-only fallback. */
    section: "fulltext" | "abstract" | "fixture";
    /** Character length of the resolved paper text. */
    chars: number;
  };
}

/** Emitted just before the extraction LLM call. */
export interface ExtractingEvent {
  stage: "extracting";
}

/** After extraction: the outcomes the paper actually reported. */
export interface ReportedEvent {
  stage: "reported";
  reportedOutcomes: ReportedOutcome[];
}

/** Emitted just before the matching LLM call. */
export interface MatchingEvent {
  stage: "matching";
}

/** One event per resolved OutcomeMatch, so ledger rows stream in one by one. */
export interface MatchEvent {
  stage: "match";
  match: OutcomeMatch;
  /** 1-based position and total, for progress display. */
  index: number;
  total: number;
}

/** After scoring: the integrity score and its explainable breakdown. */
export interface ScoredEvent {
  stage: "scored";
  integrityScore: number;
  scoreBreakdown: ScoreBreakdownLike;
}

/** Terminal success: the fully-assembled, schema-validated AuditResult. */
export interface DoneEvent {
  stage: "done";
  auditResult: AuditResult;
}

/** Terminal failure at any stage. */
export interface ErrorEvent {
  stage: "error";
  message: string;
  /** Which stage failed, when known, so the UI can be specific. */
  failedStage?: Exclude<AuditStage, "error">;
}

export type AuditEvent =
  | RegistryEvent
  | PaperEvent
  | ExtractingEvent
  | ReportedEvent
  | MatchingEvent
  | MatchEvent
  | ScoredEvent
  | DoneEvent
  | ErrorEvent;

/** Request body accepted by POST /api/audit. */
export interface AuditRequest {
  nctId: string;
  /**
   * Override where the paper text comes from. Default: "fixture" for the demo
   * trial NCT01951625, "europepmc" otherwise. "pdf" requires `pdfBase64`.
   */
  paperSource?: "fixture" | "europepmc" | "pdf";
  /** Base64-encoded PDF bytes, used only when paperSource === "pdf". */
  pdfBase64?: string;
}
