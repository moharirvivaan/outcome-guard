/**
 * Structural shape of a score breakdown, for the streaming contract.
 *
 * The concrete scoring implementation lives in the feature layer
 * (`src/lib/report/score.ts`) and MUST NOT be imported by the contract — that
 * would invert the dependency (contract is read-only, feature code depends on
 * it, not the reverse). So the contract carries this loose structural type that
 * the real `ScoreBreakdown` is assignable to, letting `ScoredEvent` transmit a
 * breakdown without the contract knowing how it was computed.
 */
export interface ScorePenaltyTermLike {
  category: string;
  label: string;
  count: number;
  weight: number;
  k: number;
  points: number;
}

export interface ScoreBreakdownLike {
  score: number;
  baseline: number;
  totalPenalty: number;
  terms: ScorePenaltyTermLike[];
  counts: Record<string, number>;
}
