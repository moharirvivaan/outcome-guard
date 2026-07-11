import { z } from "zod";
import { RegisteredOutcomeSchema } from "./outcomes";

/**
 * Shared contract: the trial record (registry side).
 *
 * READ-ONLY to feature code. See CLAUDE.md.
 */

/** A reference to a results publication for a trial. */
export const PublicationRefSchema = z.object({
  /** Citation text or title, verbatim from the registry when available. */
  citation: z.string().min(1),
  /** PubMed ID, if known. */
  pmid: z.string().optional(),
  /** DOI, if known. */
  doi: z.string().optional(),
  /** Resolvable URL to the publication, if known. */
  url: z.string().url().optional(),
});
export type PublicationRef = z.infer<typeof PublicationRefSchema>;

/**
 * A trial as prespecified in the registry, distilled from the
 * ClinicalTrials.gov API v2 study record into just what the audit needs.
 */
export const TrialRecordSchema = z.object({
  /** The NCT identifier, e.g. "NCT01951625". */
  nctId: z.string().regex(/^NCT\d{8}$/, "expected an NCT id like NCT01951625"),
  /** Trial title (brief title from the registry). */
  title: z.string().min(1),
  /** Overall recruitment/completion status, verbatim from the registry. */
  status: z.string().min(1),
  /** Prespecified outcomes from the registry. */
  registeredOutcomes: z.array(RegisteredOutcomeSchema),
  /** References to the results publication(s) for this trial. */
  resultPublicationRefs: z.array(PublicationRefSchema),
});
export type TrialRecord = z.infer<typeof TrialRecordSchema>;
