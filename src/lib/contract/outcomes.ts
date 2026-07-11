import { z } from "zod";

/**
 * Shared contract: outcome shapes.
 *
 * READ-ONLY to feature code. Import these; do not edit them to fit a feature.
 * See CLAUDE.md for the rationale.
 */

/**
 * An outcome as it was *prespecified in the trial registry*
 * (ClinicalTrials.gov API v2 `outcomesModule`).
 */
export const RegisteredOutcomeSchema = z.object({
  /** The outcome measure text, verbatim from the registry. */
  measure: z.string().min(1),
  /** Registry description / how it is measured. May be absent in the source. */
  description: z.string().optional(),
  /** The prespecified time frame (e.g. "Baseline, Week 12"). */
  timeFrame: z.string().optional(),
  /**
   * Registry classification of the outcome.
   *
   * ClinicalTrials.gov distinguishes primary / secondary / other; for the
   * purpose of the audit we treat "other" registry outcomes as secondary,
   * so the two-valued type below is the contract. Preserve the raw registry
   * bucket in `sourceType` when the distinction matters.
   */
  type: z.enum(["primary", "secondary"]),
  /** The raw registry bucket this came from, for provenance. */
  sourceType: z.enum(["primary", "secondary", "other"]).optional(),
});
export type RegisteredOutcome = z.infer<typeof RegisteredOutcomeSchema>;

/**
 * An outcome as it was *actually reported in the results publication*
 * (the paper). Backed by a verbatim quote so every claim is auditable.
 */
export const ReportedOutcomeSchema = z.object({
  /** The outcome measure as described in the paper. */
  measure: z.string().min(1),
  /** Verbatim text from the paper that reports this outcome. The evidence. */
  verbatimQuote: z.string().min(1),
  /** Where in the paper the quote came from (e.g. "Methods", "Results", "Table 2"). */
  section: z.string().min(1),
});
export type ReportedOutcome = z.infer<typeof ReportedOutcomeSchema>;
