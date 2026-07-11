/**
 * The shared data contract for outcome-guard.
 *
 * READ-ONLY to feature code: import types and schemas from here; do not edit
 * the contract to accommodate a feature. See CLAUDE.md.
 *
 * Every schema is a Zod schema with a TypeScript type inferred from it, so the
 * runtime shape and the compile-time type can never drift apart.
 */

export {
  RegisteredOutcomeSchema,
  type RegisteredOutcome,
  ReportedOutcomeSchema,
  type ReportedOutcome,
} from "./outcomes";

export {
  OutcomeClassificationSchema,
  type OutcomeClassification,
  OutcomeMatchSchema,
  type OutcomeMatch,
} from "./match";

export {
  PublicationRefSchema,
  type PublicationRef,
  TrialRecordSchema,
  type TrialRecord,
} from "./trial";

export {
  AuditMetadataSchema,
  type AuditMetadata,
  AuditResultSchema,
  type AuditResult,
} from "./audit";
