import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import {
  OutcomeMatchSchema,
  type OutcomeMatch,
  type RegisteredOutcome,
  type ReportedOutcome,
} from "@/lib/contract";
import { extractReported, type PaperInput } from "./extractReported";

/**
 * Matching pass (Subagent B, step 2) — THE core of outcome-guard.
 *
 * Aligns the registry's prespecified outcomes against the outcomes the paper
 * actually reported, and classifies each relationship per the contract
 * taxonomy. Uses `generateObject` with Opus for the reasoning-heavy alignment.
 *
 * The classifier must handle the hard cases:
 *  - RENAMED outcomes: same clinical concept, different wording -> semantic match.
 *  - COMPOSITE / SPLIT: registry bundles "HF hospitalization and CV mortality";
 *    paper reports a "CV death or HF hospitalization" composite -> reason about
 *    the overlap and match them rather than calling both dropped+added.
 *  - TIMEFRAME changes: reported, but at a different time frame -> timeframe_changed.
 */

const MODEL = "claude-opus-4-8";

/** Wrapper schema — generateObject needs an object at the top level. */
const MatchResultSchema = z.object({
  matches: z.array(OutcomeMatchSchema),
});

const SYSTEM_PROMPT = `You are the outcome-switching auditor at the heart of a clinical-trial integrity tool. You are given (A) the PRESPECIFIED outcomes from a trial registry and (B) the outcomes a results PAPER actually reported (each with a verbatim quote). Your job is to ALIGN them and classify every relationship, exposing silent outcome switching.

You will receive two numbered lists: REGISTERED[i] and REPORTED[j]. Emit a list of matches. Each match sets:
  - registeredRef: the index i into REGISTERED, or null.
  - reportedRef: the index j into REPORTED, or null.
  - classification: one of the taxonomy values below.
  - confidence: 0..1 — your confidence in this classification.
  - rationale: a short justification that cites the concept/quote/time frame you used.

TAXONOMY (classification enum):
  • reported_as_prespecified — a registered outcome that the paper reports faithfully (same concept, same/compatible time frame). registeredRef + reportedRef both set. CLEAN.
  • silently_dropped — a registered outcome the paper does NOT report at all. registeredRef set, reportedRef null.
  • silently_added — a reported outcome that was NEVER prespecified in the registry. reportedRef set, registeredRef null.
  • promoted — a prespecified SECONDARY reported/treated as the primary. Both set.
  • demoted — a prespecified PRIMARY reported/treated as merely secondary/exploratory. Both set.
  • timeframe_changed — reported, but at a DIFFERENT time frame than registered. Both set.

MATCHING PRINCIPLES — reason semantically, not by string equality:
  1. RENAMED / REWORDED: "Change From Baseline in Log-Transformed NT-proBNP to Week 12" (registry) and "change in log-transformed NT-proBNP level from baseline to 12 weeks" (paper) are the SAME outcome — match them, do not call one dropped and one added. Match on the underlying clinical concept + measure.
  2. COMPOSITE / SPLIT / OVERLAP: A registry entry may bundle several concepts (e.g. "Number of Subjects With Clinical Events (HF Hospitalization and CV Mortality)") while the paper reports a composite ("CV death or HF hospitalization") and/or the individual components. When a reported composite substantially overlaps a registered bundle, treat it as reported_as_prespecified for that registered entry (note the composition change in rationale). Do NOT double-count it as both a drop and an add. If the paper ADDS genuinely new component breakdowns that were never prespecified, those extra rows are silently_added.
  3. TIMEFRAME: If concept matches but the reported time frame differs from the registered one (e.g. registry "16 weeks" vs paper "12 weeks"), classify timeframe_changed, not dropped.
  4. GRANULARITY: Do not mark a registered outcome dropped just because the paper's wording is coarser — check whether the paper's aggregate or a table row covers it. Conversely, a paper outcome with NO plausible registry counterpart is silently_added.
  5. EXPLORATORY REFRAMING: A paper calling a prespecified secondary "exploratory" does NOT make it dropped if it is still reported — it is reported_as_prespecified (optionally note the demotion). But a prespecified outcome that is simply absent from the paper (no quote, no table row, no mention) IS silently_dropped even if the Methods vaguely gesture at its category (e.g. "multiple biomarker levels" does NOT report the individual named biomarkers).

COVERAGE REQUIREMENTS (emit exactly these, no more, no less):
  - EVERY registered outcome must appear in exactly one match (matched, dropped, promoted, demoted, or timeframe_changed).
  - EVERY reported outcome must be accounted for: either matched to a registered outcome (reported_as_prespecified / promoted / demoted / timeframe_changed) or emitted as silently_added.
  - A reported outcome matched to a registered outcome shares that one match; do not also emit it as added.

Be decisive but honest with confidence. Cite specifics in every rationale.`;

function renderRegistered(registered: RegisteredOutcome[]): string {
  return registered
    .map(
      (o, i) =>
        `REGISTERED[${i}] (${o.type}${o.sourceType ? `/${o.sourceType}` : ""}): "${o.measure}"` +
        (o.timeFrame ? ` [time frame: ${o.timeFrame}]` : "")
    )
    .join("\n");
}

function renderReported(reported: ReportedOutcome[]): string {
  return reported
    .map(
      (o, j) =>
        `REPORTED[${j}] (section: ${o.section}): "${o.measure}"\n    quote: "${o.verbatimQuote}"`
    )
    .join("\n");
}

/**
 * Align registered vs reported outcomes and classify each relationship.
 *
 * @throws if ANTHROPIC_API_KEY is missing (SDK surfaces an auth error).
 *         Callers needing graceful degradation should guard on the env var.
 */
export async function matchOutcomes(
  registered: RegisteredOutcome[],
  reported: ReportedOutcome[]
): Promise<OutcomeMatch[]> {
  const prompt = `REGISTERED OUTCOMES (prespecified in the trial registry):\n${renderRegistered(
    registered
  )}\n\nREPORTED OUTCOMES (actually reported in the paper):\n${renderReported(
    reported
  )}\n\nAlign and classify every outcome per the taxonomy. Remember: match renamed/composite outcomes semantically, use timeframe_changed for time-frame shifts, silently_dropped for prespecified outcomes with no reported counterpart, and silently_added for reported outcomes with no registry counterpart.`;

  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: MatchResultSchema,
    maxOutputTokens: 8192,
    system: SYSTEM_PROMPT,
    prompt,
  });

  // Validate every match against the contract, and range-check the refs so a
  // hallucinated index can never leak into the AuditResult.
  return object.matches.map((m) => {
    const parsed = OutcomeMatchSchema.parse(m);
    if (
      parsed.registeredRef !== null &&
      (parsed.registeredRef < 0 || parsed.registeredRef >= registered.length)
    ) {
      throw new Error(
        `matchOutcomes: registeredRef ${parsed.registeredRef} out of range (0..${registered.length - 1})`
      );
    }
    if (
      parsed.reportedRef !== null &&
      (parsed.reportedRef < 0 || parsed.reportedRef >= reported.length)
    ) {
      throw new Error(
        `matchOutcomes: reportedRef ${parsed.reportedRef} out of range (0..${reported.length - 1})`
      );
    }
    return parsed;
  });
}

/**
 * Convenience two-call flow: extract reported outcomes from paper text, then
 * match them against the registered outcomes. Track D / the UI can drive the
 * whole engine through this single entry point.
 */
export async function runEngine(
  registered: RegisteredOutcome[],
  paper: PaperInput
): Promise<{ reported: ReportedOutcome[]; matches: OutcomeMatch[] }> {
  const reported = await extractReported(paper);
  const matches = await matchOutcomes(registered, reported);
  return { reported, matches };
}
