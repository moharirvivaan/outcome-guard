/**
 * Integrity scoring for an outcome-switching audit.
 *
 * Pure and deterministic: no I/O, no randomness, no LLM. Given an AuditResult
 * it returns a 0–100 integrity score (higher = the paper adhered more closely
 * to what the trial prespecified in the registry).
 *
 * The scoring model is a simple additive-penalty scheme. A trial starts at a
 * perfect 100 and loses points for each discrepancy the matcher found. The
 * weighting is deliberately steep for the offence that matters most in the
 * outcome-switching literature: silently dropping a *primary* outcome. A single
 * dropped primary should, on its own, tank the score.
 */

import type {
  AuditResult,
  OutcomeMatch,
  OutcomeClassification,
} from "@/lib/contract";

/**
 * Penalty weights, in points off a 100 baseline. Ordered by severity.
 *
 * Rationale (decreasing weight):
 *  - A silently DROPPED PRIMARY outcome is the cardinal sin of outcome
 *    switching: the trial's own pre-registered headline result went missing.
 *    We charge a large fixed penalty so a single dropped primary alone drags
 *    the score into failing territory.
 *  - A silently dropped SECONDARY is serious but less so than losing the
 *    primary.
 *  - A SILENTLY ADDED outcome (reported but never prespecified) is the other
 *    half of outcome switching — a fishing-expedition result.
 *  - DEMOTED / PROMOTED (a primary reported as secondary, or vice versa)
 *    distorts emphasis but the outcome is at least still present.
 *  - A TIMEFRAME CHANGE (reported at a different time point than registered)
 *    is the mildest switch.
 *  - reported_as_prespecified is clean: it adds no penalty. We additionally
 *    give a small REWARD per faithfully-reported outcome so a diligent trial
 *    can recover ground lost to a minor infraction (never above 100).
 */
export const PENALTY = {
  /** Silently dropping a prespecified PRIMARY outcome. Heaviest by far. */
  DROPPED_PRIMARY: 60,
  /** Silently dropping a prespecified SECONDARY outcome. */
  DROPPED_SECONDARY: 12,
  /** Reporting an outcome that was never prespecified. */
  SILENTLY_ADDED: 10,
  /** Primary reported as secondary. */
  DEMOTED: 8,
  /** Secondary reported/treated as primary. */
  PROMOTED: 8,
  /** Reported, but at a different time frame than registered. */
  TIMEFRAME_CHANGED: 5,
} as const;

/** Small credit per faithfully-reported outcome. Cosmetic; capped by the 100 clamp. */
export const REWARD_PER_FAITHFUL = 1;

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const BASELINE = 100;

/** Component of the penalty attributable to one classification bucket. */
export interface ScoreComponent {
  classification: OutcomeClassification | "dropped_primary" | "dropped_secondary";
  /** Human label for UI/letter. */
  label: string;
  /** How many matches fell in this bucket. */
  count: number;
  /** Penalty (points off) per item in this bucket. Negative for the faithful reward. */
  perItem: number;
  /** Total points contributed by this bucket (count * perItem). Negative = credit. */
  points: number;
}

/** Structured explanation of how the score was computed, for the UI and letter. */
export interface ScoreBreakdown {
  /** The final clamped score, identical to computeIntegrityScore(audit). */
  score: number;
  /** Where the score started before penalties/credits. */
  baseline: number;
  /** Sum of penalty points (positive = points lost). */
  totalPenalty: number;
  /** Sum of reward points (positive = points credited back). */
  totalReward: number;
  /** Per-bucket components, penalties first then the faithful-reporting credit. */
  components: ScoreComponent[];
  /** Convenience counts used across the app and the letter. */
  counts: {
    faithful: number;
    droppedPrimary: number;
    droppedSecondary: number;
    silentlyAdded: number;
    promoted: number;
    demoted: number;
    timeframeChanged: number;
  };
}

/**
 * True when a `silently_dropped` match points at a registered outcome whose
 * registry `type` is "primary". Looks the ref up in the trial record; a match
 * with a null or out-of-range registeredRef is treated as non-primary (it
 * cannot be a dropped registered outcome without one).
 */
function isDroppedPrimary(match: OutcomeMatch, audit: AuditResult): boolean {
  if (match.classification !== "silently_dropped") return false;
  const ref = match.registeredRef;
  if (ref === null) return false;
  const registered = audit.trialRecord.registeredOutcomes[ref];
  return registered?.type === "primary";
}

/**
 * Compute the full, explainable breakdown behind the integrity score.
 *
 * Exposed so the UI and the letter generator can show *why* the number is what
 * it is rather than just the number. `computeIntegrityScore` is a thin wrapper
 * over this.
 */
export function scoreBreakdown(audit: AuditResult): ScoreBreakdown {
  const counts = {
    faithful: 0,
    droppedPrimary: 0,
    droppedSecondary: 0,
    silentlyAdded: 0,
    promoted: 0,
    demoted: 0,
    timeframeChanged: 0,
  };

  for (const match of audit.matches) {
    switch (match.classification) {
      case "reported_as_prespecified":
        counts.faithful++;
        break;
      case "silently_dropped":
        if (isDroppedPrimary(match, audit)) counts.droppedPrimary++;
        else counts.droppedSecondary++;
        break;
      case "silently_added":
        counts.silentlyAdded++;
        break;
      case "promoted":
        counts.promoted++;
        break;
      case "demoted":
        counts.demoted++;
        break;
      case "timeframe_changed":
        counts.timeframeChanged++;
        break;
    }
  }

  const penaltyComponents: ScoreComponent[] = [
    {
      classification: "dropped_primary",
      label: "Silently dropped PRIMARY outcome",
      count: counts.droppedPrimary,
      perItem: PENALTY.DROPPED_PRIMARY,
      points: counts.droppedPrimary * PENALTY.DROPPED_PRIMARY,
    },
    {
      classification: "dropped_secondary",
      label: "Silently dropped secondary outcome",
      count: counts.droppedSecondary,
      perItem: PENALTY.DROPPED_SECONDARY,
      points: counts.droppedSecondary * PENALTY.DROPPED_SECONDARY,
    },
    {
      classification: "silently_added",
      label: "Silently added (unprespecified) outcome",
      count: counts.silentlyAdded,
      perItem: PENALTY.SILENTLY_ADDED,
      points: counts.silentlyAdded * PENALTY.SILENTLY_ADDED,
    },
    {
      classification: "demoted",
      label: "Demoted (primary reported as secondary)",
      count: counts.demoted,
      perItem: PENALTY.DEMOTED,
      points: counts.demoted * PENALTY.DEMOTED,
    },
    {
      classification: "promoted",
      label: "Promoted (secondary reported as primary)",
      count: counts.promoted,
      perItem: PENALTY.PROMOTED,
      points: counts.promoted * PENALTY.PROMOTED,
    },
    {
      classification: "timeframe_changed",
      label: "Time frame changed vs. registration",
      count: counts.timeframeChanged,
      perItem: PENALTY.TIMEFRAME_CHANGED,
      points: counts.timeframeChanged * PENALTY.TIMEFRAME_CHANGED,
    },
  ];

  const rewardComponent: ScoreComponent = {
    classification: "reported_as_prespecified",
    label: "Faithfully reported as prespecified",
    count: counts.faithful,
    perItem: -REWARD_PER_FAITHFUL,
    points: -(counts.faithful * REWARD_PER_FAITHFUL),
  };

  const totalPenalty = penaltyComponents.reduce((sum, c) => sum + c.points, 0);
  const totalReward = counts.faithful * REWARD_PER_FAITHFUL;

  const raw = BASELINE - totalPenalty + totalReward;
  const score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(raw)));

  return {
    score,
    baseline: BASELINE,
    totalPenalty,
    totalReward,
    components: [...penaltyComponents, rewardComponent],
    counts,
  };
}

/**
 * The integrity score, 0–100. Higher = the paper adhered more closely to the
 * registered outcomes. Pure and deterministic.
 */
export function computeIntegrityScore(audit: AuditResult): number {
  return scoreBreakdown(audit).score;
}
