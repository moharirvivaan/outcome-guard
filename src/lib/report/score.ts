/**
 * Integrity scoring for an outcome-switching audit.
 *
 * Pure and deterministic: no I/O, no randomness, no LLM. Given an AuditResult
 * it returns a 0–100 integrity score (higher = the paper adhered more closely
 * to what the trial prespecified in the registry).
 *
 * SCORING MODEL — saturating per-category penalties (not linear stacking).
 *
 * The score starts at 100 and subtracts three penalty terms — one for dropped
 * PRIMARY outcomes, one for dropped SECONDARY outcomes, one for ADDED
 * (unprespecified) outcomes — then floors at 0 and rounds to an int.
 *
 * Each term SATURATES: the first offence in a category hurts a lot and each
 * additional one hurts less, so penalties can't stack linearly past the
 * 100-point budget and collapse every bad trial to 0. This preserves ordering
 * (more drops still always => lower score) while keeping usable dynamic range.
 *
 *   penalty_category = WEIGHT * saturate(count, k)
 *   saturate(n, k)   = 1 - exp(-n / k)          // 0 at n=0, → 1 as n grows
 *   score            = round( max(0, 100 - primary - secondary - added) )
 *
 * Why the shape:
 *  - A dropped PRIMARY is the cardinal sin (k=1): even one is a ~38-point hit
 *    (60·(1-e^-1) ≈ 37.9 → score 62), two push past 50. Primary stays king.
 *  - Secondaries saturate at k=4: 1 drop ≈ 17 pts, but ~13 drops ≈ 71 pts
 *    (not 13·something linear) — many drops still hurt, but can't alone zero it.
 *  - Added outcomes saturate at k=6, capping a wall of additions near 20 pts.
 *
 * Mild "switch" classifications (demoted / promoted / timeframe_changed) have
 * no term of their own; they are FOLDED into the three counts so no discrepancy
 * is ever free: a demoted outcome counts as a dropped-secondary-equivalent
 * (its prespecified emphasis was lost), and promoted / timeframe_changed count
 * as added-equivalents (something not-as-registered was surfaced instead).
 */

import type { AuditResult, OutcomeMatch } from "@/lib/contract";

/**
 * Penalty WEIGHTS — the maximum points a category can ever remove (the value
 * each saturating term approaches as its count → ∞).
 */
export const PENALTY_WEIGHT = {
  /** Silently dropping prespecified PRIMARY outcomes. Heaviest by far. */
  DROPPED_PRIMARY: 60,
  /** Silently dropping prespecified SECONDARY outcomes (incl. demoted). */
  DROPPED_SECONDARY: 75,
  /** Reporting outcomes never prespecified (incl. promoted / timeframe_changed). */
  ADDED: 20,
} as const;

/**
 * Saturation constants `k` — larger k = slower saturation (each additional
 * offence keeps mattering for longer). k=1 for primary means a single drop
 * already lands most of the weight.
 */
export const PENALTY_K = {
  DROPPED_PRIMARY: 1,
  DROPPED_SECONDARY: 4,
  ADDED: 6,
} as const;

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const BASELINE = 100;

/**
 * Diminishing-returns curve: 0 when n=0, approaching 1 as n grows.
 * `saturate(n, k) = 1 - exp(-n / k)`.
 */
export function saturate(n: number, k: number): number {
  if (n <= 0) return 0;
  return 1 - Math.exp(-n / k);
}

/** One of the three penalty terms, with the arithmetic exposed for the UI/letter. */
export interface PenaltyTerm {
  category: "dropped_primary" | "dropped_secondary" | "added";
  /** Human label for UI/letter. */
  label: string;
  /** How many outcomes fed this term (after folding). */
  count: number;
  /** Maximum this category could ever remove (the saturating weight). */
  weight: number;
  /** Saturation constant used. */
  k: number;
  /** Actual points removed = weight * saturate(count, k). */
  points: number;
}

/** Structured explanation of how the score was computed, for the UI and letter. */
export interface ScoreBreakdown {
  /** The final clamped score, identical to computeIntegrityScore(audit). */
  score: number;
  /** Where the score started before penalties. */
  baseline: number;
  /** Sum of all penalty points removed (positive = points lost). */
  totalPenalty: number;
  /** The three saturating penalty terms. */
  terms: PenaltyTerm[];
  /**
   * Raw classification counts BEFORE folding, plus the folded counts that
   * actually feed the three terms. `faithful` is informational (not scored).
   */
  counts: {
    faithful: number;
    droppedPrimary: number;
    droppedSecondary: number;
    silentlyAdded: number;
    promoted: number;
    demoted: number;
    timeframeChanged: number;
    /** droppedSecondary + demoted — feeds the secondary term. */
    foldedDroppedSecondary: number;
    /** silentlyAdded + promoted + timeframeChanged — feeds the added term. */
    foldedAdded: number;
  };
}

/**
 * True when a `silently_dropped` match points at a registered outcome whose
 * registry `type` is "primary". A match with a null or out-of-range
 * registeredRef is treated as non-primary (it cannot be a dropped registered
 * outcome without one).
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
 * it is. `computeIntegrityScore` is a thin wrapper over this.
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

  // Fold the mild switches in so no discrepancy is free:
  //  - demoted counts as a dropped-secondary-equivalent (emphasis lost);
  //  - promoted / timeframe_changed count as added-equivalents.
  const foldedDroppedSecondary = counts.droppedSecondary + counts.demoted;
  const foldedAdded =
    counts.silentlyAdded + counts.promoted + counts.timeframeChanged;

  const terms: PenaltyTerm[] = [
    {
      category: "dropped_primary",
      label: "Silently dropped PRIMARY outcome(s)",
      count: counts.droppedPrimary,
      weight: PENALTY_WEIGHT.DROPPED_PRIMARY,
      k: PENALTY_K.DROPPED_PRIMARY,
      points:
        PENALTY_WEIGHT.DROPPED_PRIMARY *
        saturate(counts.droppedPrimary, PENALTY_K.DROPPED_PRIMARY),
    },
    {
      category: "dropped_secondary",
      label: "Silently dropped / demoted secondary outcome(s)",
      count: foldedDroppedSecondary,
      weight: PENALTY_WEIGHT.DROPPED_SECONDARY,
      k: PENALTY_K.DROPPED_SECONDARY,
      points:
        PENALTY_WEIGHT.DROPPED_SECONDARY *
        saturate(foldedDroppedSecondary, PENALTY_K.DROPPED_SECONDARY),
    },
    {
      category: "added",
      label: "Silently added / unprespecified outcome(s)",
      count: foldedAdded,
      weight: PENALTY_WEIGHT.ADDED,
      k: PENALTY_K.ADDED,
      points: PENALTY_WEIGHT.ADDED * saturate(foldedAdded, PENALTY_K.ADDED),
    },
  ];

  const totalPenalty = terms.reduce((sum, t) => sum + t.points, 0);
  const raw = BASELINE - totalPenalty;
  const score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(raw)));

  return {
    score,
    baseline: BASELINE,
    totalPenalty,
    terms,
    counts: { ...counts, foldedDroppedSecondary, foldedAdded },
  };
}

/**
 * The integrity score, 0–100. Higher = the paper adhered more closely to the
 * registered outcomes. Pure and deterministic.
 */
export function computeIntegrityScore(audit: AuditResult): number {
  return scoreBreakdown(audit).score;
}
