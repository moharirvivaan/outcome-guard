/**
 * Unit tests for the saturating integrity-score model in ./score.ts.
 *
 * No test-runner dependency: these use Node's built-in `node:test` + `node:assert`.
 * Run with:  npx tsx --test src/lib/report/score.test.ts
 *
 * The tests build minimal AuditResult fixtures with the exact classification
 * counts each scenario needs, then assert the score lands in the intended band.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeIntegrityScore,
  scoreBreakdown,
  saturate,
} from "./score";
import type {
  AuditResult,
  OutcomeMatch,
  RegisteredOutcome,
  ReportedOutcome,
} from "@/lib/contract";

/**
 * Build an AuditResult with the requested numbers of each match kind.
 * Registered outcome 0 is PRIMARY, 1 is SECONDARY — dropped matches point at
 * whichever type they need so `isDroppedPrimary` resolves correctly.
 */
function makeAudit(opts: {
  droppedPrimary?: number;
  droppedSecondary?: number;
  added?: number;
  demoted?: number;
  promoted?: number;
  timeframeChanged?: number;
  faithful?: number;
}): AuditResult {
  const {
    droppedPrimary = 0,
    droppedSecondary = 0,
    added = 0,
    demoted = 0,
    promoted = 0,
    timeframeChanged = 0,
    faithful = 0,
  } = opts;

  const registeredOutcomes: RegisteredOutcome[] = [
    { measure: "Primary measure", type: "primary" },
    { measure: "Secondary measure", type: "secondary" },
  ];
  const reportedOutcomes: ReportedOutcome[] = [];
  const matches: OutcomeMatch[] = [];

  const pushDrop = (type: "primary" | "secondary", i: number) =>
    matches.push({
      registeredRef: type === "primary" ? 0 : 1,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.9,
      rationale: `dropped ${type} #${i}`,
    });

  for (let i = 0; i < droppedPrimary; i++) pushDrop("primary", i);
  for (let i = 0; i < droppedSecondary; i++) pushDrop("secondary", i);

  const pushReported = (
    classification: OutcomeMatch["classification"],
    i: number,
  ) => {
    reportedOutcomes.push({
      measure: `${classification} #${i}`,
      verbatimQuote: `quote for ${classification} #${i}`,
      section: "Results",
    });
    const reportedRef = reportedOutcomes.length - 1;
    matches.push({
      // added has no registered counterpart; the switch kinds reference the
      // secondary registered outcome (their exact ref does not affect scoring
      // beyond the primary/secondary distinction, which only drops use).
      registeredRef: classification === "silently_added" ? null : 1,
      reportedRef,
      classification,
      confidence: 0.8,
      rationale: `${classification} #${i}`,
    });
  };

  for (let i = 0; i < added; i++) pushReported("silently_added", i);
  for (let i = 0; i < demoted; i++) pushReported("demoted", i);
  for (let i = 0; i < promoted; i++) pushReported("promoted", i);
  for (let i = 0; i < timeframeChanged; i++) pushReported("timeframe_changed", i);
  for (let i = 0; i < faithful; i++) pushReported("reported_as_prespecified", i);

  return {
    trialRecord: {
      nctId: "NCT00000000",
      title: "Test trial",
      status: "COMPLETED",
      registeredOutcomes,
      resultPublicationRefs: [{ citation: "Test et al. 2025" }],
    },
    reportedOutcomes,
    matches,
    integrityScore: 0, // not read by the scorer
    metadata: { registrySource: "test", paperSource: "test" },
  };
}

test("saturate: 0 at n=0, monotonic increasing, never exceeds 1", () => {
  assert.equal(saturate(0, 4), 0);
  assert.ok(saturate(1, 4) > 0);
  assert.ok(saturate(8, 4) > saturate(4, 4));
  // strictly below 1 in the realistic range, and never above 1 even when the
  // exp term underflows to 0 for huge n.
  assert.ok(saturate(20, 4) < 1);
  assert.ok(saturate(1e6, 4) <= 1);
});

test("clean trial (no discrepancies) scores 100", () => {
  const audit = makeAudit({ faithful: 10 });
  assert.equal(computeIntegrityScore(audit), 100);
});

test("one dropped PRIMARY alone lands ~62", () => {
  const score = computeIntegrityScore(makeAudit({ droppedPrimary: 1 }));
  assert.ok(score >= 60 && score <= 64, `expected ~62, got ${score}`);
});

test("two dropped primaries push past 50 (down to ~48)", () => {
  const score = computeIntegrityScore(makeAudit({ droppedPrimary: 2 }));
  assert.ok(score <= 50, `expected <=50, got ${score}`);
});

test("the demo trial (primary kept, ~8 secondaries + 5 demoted dropped, 3 added) lands high-teens/low-20s", () => {
  // Mirrors the real mockAudit: 8 silently_dropped secondaries, 5 demoted
  // (fold into secondary => 13), 3 silently_added, 1 faithful primary.
  const audit = makeAudit({
    droppedSecondary: 8,
    demoted: 5,
    added: 3,
    faithful: 1,
  });
  const score = computeIntegrityScore(audit);
  assert.ok(score >= 15 && score <= 24, `expected high-teens/low-20s, got ${score}`);
});

test("a fully-switched trial (primary dropped + many secondaries + many added) is single digits", () => {
  const score = computeIntegrityScore(
    makeAudit({ droppedPrimary: 1, droppedSecondary: 13, added: 12 }),
  );
  assert.ok(score <= 9, `expected single digits, got ${score}`);
});

test("penalties saturate: 8 dropped secondaries do NOT alone zero the score (vs linear 8*12=96)", () => {
  const score = computeIntegrityScore(makeAudit({ droppedSecondary: 8 }));
  assert.ok(score > 20, `saturating secondary term should leave headroom, got ${score}`);
  // and it is worse than 1 dropped secondary (ordering preserved)
  const one = computeIntegrityScore(makeAudit({ droppedSecondary: 1 }));
  assert.ok(one > score, `more drops must score lower: 1->${one}, 8->${score}`);
});

test("ordering: more added always scores <= fewer added", () => {
  const a = computeIntegrityScore(makeAudit({ added: 2 }));
  const b = computeIntegrityScore(makeAudit({ added: 20 }));
  assert.ok(b <= a, `20 added (${b}) must not score above 2 added (${a})`);
});

test("mild switches are folded, not free: demoted lowers the score", () => {
  const withoutDemoted = computeIntegrityScore(makeAudit({ droppedSecondary: 2 }));
  const withDemoted = computeIntegrityScore(
    makeAudit({ droppedSecondary: 2, demoted: 3 }),
  );
  assert.ok(
    withDemoted < withoutDemoted,
    `demoted must cost points: ${withoutDemoted} -> ${withDemoted}`,
  );
});

test("breakdown exposes the three terms and folded counts for the UI", () => {
  const b = scoreBreakdown(
    makeAudit({ droppedSecondary: 8, demoted: 5, added: 3, promoted: 1, faithful: 1 }),
  );
  assert.equal(b.terms.length, 3);
  assert.equal(b.counts.foldedDroppedSecondary, 13); // 8 + 5 demoted
  assert.equal(b.counts.foldedAdded, 4); // 3 added + 1 promoted
  assert.equal(b.score, computeIntegrityScore(
    makeAudit({ droppedSecondary: 8, demoted: 5, added: 3, promoted: 1, faithful: 1 }),
  ));
  // score is an integer in range
  assert.ok(Number.isInteger(b.score) && b.score >= 0 && b.score <= 100);
});
