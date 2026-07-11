import { z } from "zod";

/**
 * Shared contract: the outcome-matching result.
 *
 * READ-ONLY to feature code. See CLAUDE.md.
 */

/**
 * How a registered outcome relates to what was reported, or how a reported
 * outcome relates to what was registered. This is the core taxonomy of
 * outcome-switching that the audit detects.
 *
 * - `reported_as_prespecified` — registered outcome reported as-is. Clean.
 * - `silently_dropped` — registered outcome not reported in the paper.
 * - `silently_added` — reported outcome that was never prespecified.
 * - `promoted` — a prespecified secondary reported/treated as primary.
 * - `demoted` — a prespecified primary reported/treated as secondary.
 * - `timeframe_changed` — reported, but at a different time frame than registered.
 */
export const OutcomeClassificationSchema = z.enum([
  "reported_as_prespecified",
  "silently_dropped",
  "silently_added",
  "promoted",
  "demoted",
  "timeframe_changed",
]);
export type OutcomeClassification = z.infer<typeof OutcomeClassificationSchema>;

/**
 * A single matching judgment between the registry and the paper.
 *
 * `registeredRef` and `reportedRef` are indices into the corresponding arrays
 * on the AuditResult (`trialRecord.registeredOutcomes` and
 * `reportedOutcomes`). One side may be null:
 * - a `silently_dropped` match has a registered ref but no reported ref;
 * - a `silently_added` match has a reported ref but no registered ref.
 */
export const OutcomeMatchSchema = z
  .object({
    /** Index into `trialRecord.registeredOutcomes`, or null if none (e.g. silently added). */
    registeredRef: z.number().int().nonnegative().nullable(),
    /** Index into `reportedOutcomes`, or null if none (e.g. silently dropped). */
    reportedRef: z.number().int().nonnegative().nullable(),
    classification: OutcomeClassificationSchema,
    /** Model/heuristic confidence in this classification, 0–1. */
    confidence: z.number().min(0).max(1),
    /** Human-readable justification, ideally citing the evidence. */
    rationale: z.string().min(1),
  })
  .refine((m) => m.registeredRef !== null || m.reportedRef !== null, {
    message: "an OutcomeMatch must reference at least one side (registered or reported)",
  });
export type OutcomeMatch = z.infer<typeof OutcomeMatchSchema>;
