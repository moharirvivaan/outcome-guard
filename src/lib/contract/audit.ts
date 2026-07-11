import { z } from "zod";
import { ReportedOutcomeSchema } from "./outcomes";
import { OutcomeMatchSchema } from "./match";
import { TrialRecordSchema } from "./trial";

/**
 * Shared contract: the top-level audit result.
 *
 * READ-ONLY to feature code. See CLAUDE.md.
 */

/** Provenance / bookkeeping for how an audit was produced. */
export const AuditMetadataSchema = z.object({
  /** Where the registry data came from (e.g. "clinicaltrials.gov/api/v2" or a fixture path). */
  registrySource: z.string().min(1),
  /** Where the paper text came from (e.g. "europepmc", "pdf:demo-assets/NCT01951625.pdf"). */
  paperSource: z.string().min(1),
  /** Model identifier used for extraction/matching, if any. */
  model: z.string().optional(),
  /** ISO-8601 timestamp of when the audit ran. Stamped by the caller. */
  generatedAt: z.string().optional(),
  /** Free-form notes/caveats about this particular audit. */
  notes: z.string().optional(),
});
export type AuditMetadata = z.infer<typeof AuditMetadataSchema>;

/**
 * The complete result of auditing one trial: the registry record, the outcomes
 * we extracted from the paper, the matches between them, an integrity score,
 * and provenance metadata.
 */
export const AuditResultSchema = z.object({
  trialRecord: TrialRecordSchema,
  reportedOutcomes: z.array(ReportedOutcomeSchema),
  matches: z.array(OutcomeMatchSchema),
  /**
   * Overall integrity score, 0–100. Higher = closer adherence between what was
   * prespecified and what was reported. The scoring function lives in feature
   * code; this is just the shape of its output.
   */
  integrityScore: z.number().min(0).max(100),
  metadata: AuditMetadataSchema,
});
export type AuditResult = z.infer<typeof AuditResultSchema>;
