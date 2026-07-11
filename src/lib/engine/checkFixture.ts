/**
 * Fixture-based check for the extraction & matching engine (Subagent B).
 *
 * Runs `extractReported -> matchOutcomes` against the NCT01951625 fixtures and
 * asserts the engine's classifications against a DERIVED, self-consistent oracle
 * (built from the registry fixture + the VERIFIED parts of DEMO_TRIALS.md's
 * GROUND TRUTH — deliberately NOT COMPare's unverified "~28 added" figure).
 *
 * DEGRADES GRACEFULLY: with no ANTHROPIC_API_KEY, it exercises the SAME
 * assertion/oracle logic against a small committed mock instead of the network,
 * so the oracle itself is always unit-tested. Exits 0 on success.
 *
 * Run:  npx tsx src/lib/engine/checkFixture.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OutcomeMatchSchema,
  RegisteredOutcomeSchema,
  type OutcomeMatch,
  type RegisteredOutcome,
  type ReportedOutcome,
} from "@/lib/contract";
import { matchOutcomes } from "./matchOutcomes";
import { extractReported, type PaperInput } from "./extractReported";

const ROOT = join(__dirname, "..", "..", "..");
const REGISTRY_FIXTURE = join(ROOT, "fixtures", "registry.NCT01951625.json");
const PAPER_FIXTURE = join(ROOT, "fixtures", "paper.NCT01951625.json");

// ---------------------------------------------------------------------------
// Fixture loading / derivation
// ---------------------------------------------------------------------------

/** Derive RegisteredOutcome[] from the raw ClinicalTrials.gov v2 registry fixture. */
function loadRegistered(): RegisteredOutcome[] {
  const raw = JSON.parse(readFileSync(REGISTRY_FIXTURE, "utf8"));
  const om = raw.protocolSection.outcomesModule;
  const primary: RegisteredOutcome[] = (om.primaryOutcomes ?? []).map(
    (o: { measure: string; description?: string; timeFrame?: string }) =>
      RegisteredOutcomeSchema.parse({
        measure: o.measure,
        description: o.description,
        timeFrame: o.timeFrame,
        type: "primary" as const,
        sourceType: "primary" as const,
      })
  );
  // Registry "otherOutcomes" bucket is treated as secondary per the contract.
  const other: RegisteredOutcome[] = (om.otherOutcomes ?? []).map(
    (o: { measure: string; description?: string; timeFrame?: string }) =>
      RegisteredOutcomeSchema.parse({
        measure: o.measure,
        description: o.description,
        timeFrame: o.timeFrame,
        type: "secondary" as const,
        sourceType: "other" as const,
      })
  );
  return [...primary, ...other];
}

function loadPaper(): PaperInput {
  const raw = JSON.parse(readFileSync(PAPER_FIXTURE, "utf8"));
  return { sections: raw.sections };
}

// ---------------------------------------------------------------------------
// Derived oracle helpers — index-based, resolved from the registered measures
// ---------------------------------------------------------------------------

/** Find the registry index whose measure text contains all given needles. */
function regIndex(registered: RegisteredOutcome[], ...needles: string[]): number {
  const idx = registered.findIndex((o) =>
    needles.every((n) => o.measure.toLowerCase().includes(n.toLowerCase()))
  );
  if (idx < 0) {
    throw new Error(
      `oracle: no registered outcome matches [${needles.join(", ")}] — fixture drift?`
    );
  }
  return idx;
}

/** The classification the engine assigned to a given registeredRef, if any. */
function classForRegistered(
  matches: OutcomeMatch[],
  registeredRef: number
): string | undefined {
  return matches.find((m) => m.registeredRef === registeredRef)?.classification;
}

// ---------------------------------------------------------------------------
// The assertion / oracle logic — exercised in BOTH the live and mock paths
// ---------------------------------------------------------------------------

interface CheckOutcome {
  passed: boolean;
  failures: string[];
  addedCount: number;
}

function runAssertions(
  registered: RegisteredOutcome[],
  matches: OutcomeMatch[]
): CheckOutcome {
  const failures: string[] = [];
  const assert = (cond: boolean, label: string, detail: string) => {
    if (cond) {
      console.log(`  PASS  ${label}`);
    } else {
      failures.push(`${label} — ${detail}`);
      console.log(`  FAIL  ${label} — ${detail}`);
    }
  };

  // (a) ICD/CRT-D therapy -> silently_dropped
  const icdIdx = regIndex(registered, "ICD/CRT-D");
  const icdClass = classForRegistered(matches, icdIdx);
  assert(
    icdClass === "silently_dropped",
    "(a) ICD/CRT-D therapy is silently_dropped",
    `got ${icdClass ?? "no match"}`
  );

  // (b) the 7 named biomarkers -> silently_dropped
  const biomarkers = [
    "Osteopontin",
    "TIMP-4",
    "cGMP",
    "PIIINP",
    "GDF-15",
    "ST2",
    "Gal-3",
  ];
  for (const bm of biomarkers) {
    const idx = regIndex(registered, bm);
    const cls = classForRegistered(matches, idx);
    assert(
      cls === "silently_dropped",
      `(b) biomarker ${bm} is silently_dropped`,
      `got ${cls ?? "no match"}`
    );
  }

  // (c) NT-proBNP primary -> reported_as_prespecified
  const ntIdx = regIndex(registered, "proBNP");
  const ntClass = classForRegistered(matches, ntIdx);
  assert(
    ntClass === "reported_as_prespecified",
    "(c) NT-proBNP primary is reported_as_prespecified",
    `got ${ntClass ?? "no match"}`
  );

  // (d) substantial silently_added count (>= 8). COMPare cites ~28 (UNVERIFIED),
  //     so we log the actual number but do not hard-assert it.
  const addedCount = matches.filter(
    (m) => m.classification === "silently_added"
  ).length;
  console.log(`  INFO  silently_added count = ${addedCount} (COMPare cites ~28, unverified)`);
  assert(
    addedCount >= 8,
    "(d) engine detects >= 8 silently_added outcomes",
    `got ${addedCount}`
  );

  return { passed: failures.length === 0, failures, addedCount };
}

// ---------------------------------------------------------------------------
// Committed mock — a plausible engine output used when no API key is present.
// Its indices are resolved from the SAME derived registry so the oracle logic
// (not hard-coded indices) is what gets exercised.
// ---------------------------------------------------------------------------

function buildMock(
  registered: RegisteredOutcome[]
): { reported: ReportedOutcome[]; matches: OutcomeMatch[] } {
  // A minimal reported set standing in for what extractReported would return.
  const reported: ReportedOutcome[] = [
    {
      measure: "Change in log-transformed NT-proBNP, baseline to week 12",
      verbatimQuote:
        "The primary end point, change in log-transformed NT-proBNP level from baseline to 12 weeks, was not significantly different",
      section: "Results — Primary End Point",
    },
    {
      measure: "Dose-response of NT-proBNP (linear regression)",
      verbatimQuote:
        "Exploratory secondary analyses of the primary end point using linear regression modeling suggested a dose-response relationship",
      section: "Results — Primary End Point",
    },
    {
      measure: "NT-proBNP, 10-mg vericiguat vs placebo pairwise",
      verbatimQuote:
        "Pairwise exploratory analyses of individual vericiguat groups found differences in the primary end point between the 10-mg vericiguat group",
      section: "Results — Exploratory End Points",
    },
    {
      measure: "All-cause death",
      verbatimQuote: "All-cause death — Placebo 3 (3.3)",
      section: "Table 3",
    },
    {
      measure: "CV death",
      verbatimQuote: "CV death — Placebo 3 (3.3)",
      section: "Table 3",
    },
    {
      measure: "HF hospitalization",
      verbatimQuote: "HF hospitalization — Placebo 16 (17.4)",
      section: "Table 3",
    },
    {
      measure: "CV death or HF hospitalization (composite)",
      verbatimQuote: "CV death or HF hospitalization — Placebo 18 (19.6)",
      section: "Table 3",
    },
    {
      measure: "LVEF change",
      verbatimQuote: "LVEF, %: Placebo 1.52; 2.5–10 mg 3.68",
      section: "Table 4",
    },
    {
      measure: "LVEDV change",
      verbatimQuote: "LVEDV, mL: Placebo −7.26",
      section: "Table 4",
    },
    {
      measure: "LVESV change",
      verbatimQuote: "LVESV, mL: Placebo −6.83",
      section: "Table 4",
    },
    {
      measure: "Systolic BP change",
      verbatimQuote: "Systolic BP, mm Hg: Placebo −5.14",
      section: "Table 4",
    },
    {
      measure: "Diastolic BP change",
      verbatimQuote: "Diastolic BP, mm Hg: Placebo −4.17",
      section: "Table 4",
    },
    {
      measure: "Heart rate change",
      verbatimQuote: "Heart rate, /min: Placebo −0.56",
      section: "Table 4",
    },
  ];

  const iNt = regIndex(registered, "proBNP");
  const iClinEvents = regIndex(registered, "Clinical Events");
  const iLvedv = regIndex(registered, "LVEDV");
  const iLvef = regIndex(registered, "LVEF");
  const iBp = regIndex(registered, "Systolic and Diastolic");
  const iHr = regIndex(registered, "Heart Rate");
  const iIcd = regIndex(registered, "ICD/CRT-D");
  const iAe = regIndex(registered, "Adverse Events");
  const biomarkerIdx = [
    "Osteopontin",
    "TIMP-4",
    "cGMP",
    "PIIINP",
    "GDF-15",
    "ST2",
    "Gal-3",
  ].map((b) => regIndex(registered, b));

  const matches: OutcomeMatch[] = [
    // NT-proBNP primary reported faithfully.
    {
      registeredRef: iNt,
      reportedRef: 0,
      classification: "reported_as_prespecified",
      confidence: 0.98,
      rationale:
        "Registry primary 'log-transformed NT-proBNP to Week 12' == paper 'change in log-transformed NT-proBNP from baseline to 12 weeks' (renamed, same concept + time frame).",
    },
    // Registered echocardiography / vitals reported via Table 4.
    {
      registeredRef: iLvef,
      reportedRef: 7,
      classification: "reported_as_prespecified",
      confidence: 0.9,
      rationale: "LVEF change reported in Table 4.",
    },
    {
      registeredRef: iLvedv,
      reportedRef: 8,
      classification: "reported_as_prespecified",
      confidence: 0.85,
      rationale: "LVEDV (and LVESV) reported in Table 4.",
    },
    {
      registeredRef: iBp,
      reportedRef: 10,
      classification: "reported_as_prespecified",
      confidence: 0.85,
      rationale: "Systolic & diastolic BP reported in Table 4.",
    },
    {
      registeredRef: iHr,
      reportedRef: 12,
      classification: "reported_as_prespecified",
      confidence: 0.85,
      rationale: "Heart rate reported in Table 4.",
    },
    // Composite clinical-events bundle matched to the paper's composite.
    {
      registeredRef: iClinEvents,
      reportedRef: 6,
      classification: "reported_as_prespecified",
      confidence: 0.72,
      rationale:
        "Registry bundle 'HF Hospitalization and CV Mortality' overlaps paper composite 'CV death or HF hospitalization'.",
    },
    // Safety AE outcome — treat as reported (safety mentioned throughout).
    {
      registeredRef: iAe,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.5,
      rationale: "No dedicated TEAE table in the extracted sections.",
    },
    // ICD/CRT-D therapy dropped.
    {
      registeredRef: iIcd,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.95,
      rationale: "ICD/CRT-D therapy never mentioned in Methods or Results.",
    },
    // 7 named biomarkers dropped.
    ...biomarkerIdx.map((idx) => ({
      registeredRef: idx,
      reportedRef: null as number | null,
      classification: "silently_dropped" as const,
      confidence: 0.9,
      rationale:
        "Methods say only 'changes in multiple biomarker levels'; this named biomarker is never reported individually.",
    })),
    // Silently added: standalone all-cause death, CV death, HF hospitalization,
    // NT-proBNP dose-response, 10-mg pairwise, LVESV standalone, etc. (>= 8).
    {
      registeredRef: null,
      reportedRef: 1,
      classification: "silently_added",
      confidence: 0.6,
      rationale: "Dose-response linear regression of NT-proBNP not prespecified as its own outcome.",
    },
    {
      registeredRef: null,
      reportedRef: 2,
      classification: "silently_added",
      confidence: 0.6,
      rationale: "10-mg vs placebo pairwise NT-proBNP reported as exploratory add-on.",
    },
    {
      registeredRef: null,
      reportedRef: 3,
      classification: "silently_added",
      confidence: 0.8,
      rationale: "All-cause death was not a prespecified registry outcome.",
    },
    {
      registeredRef: null,
      reportedRef: 4,
      classification: "silently_added",
      confidence: 0.7,
      rationale: "CV death broken out separately; not individually prespecified.",
    },
    {
      registeredRef: null,
      reportedRef: 5,
      classification: "silently_added",
      confidence: 0.7,
      rationale: "HF hospitalization broken out separately; not individually prespecified.",
    },
    {
      registeredRef: null,
      reportedRef: 9,
      classification: "silently_added",
      confidence: 0.55,
      rationale: "LVESV reported as its own row beyond the registered LVEDV/LVESV bundle framing.",
    },
    {
      registeredRef: null,
      reportedRef: 11,
      classification: "silently_added",
      confidence: 0.5,
      rationale: "Diastolic BP reported separately from systolic in an exploratory table.",
    },
    {
      registeredRef: null,
      reportedRef: 12,
      classification: "silently_added",
      confidence: 0.5,
      rationale: "Extra exploratory vital-sign breakout not individually prespecified.",
    },
  ];

  return { reported, matches: matches.map((m) => OutcomeMatchSchema.parse(m)) };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const registered = loadRegistered();
  console.log(
    `Loaded ${registered.length} registered outcomes (${registered.filter((r) => r.type === "primary").length} primary + ${registered.filter((r) => r.type === "secondary").length} secondary).`
  );

  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  let matches: OutcomeMatch[];
  if (hasKey) {
    console.log("ANTHROPIC_API_KEY present — running live engine (extract -> match).");
    const paper = loadPaper();
    const reported = await extractReported(paper);
    console.log(`Extracted ${reported.length} reported outcomes from the paper.`);
    matches = await matchOutcomes(registered, reported);
    console.log(`Produced ${matches.length} matches.`);
  } else {
    console.log(
      "SKIPPED live model calls: no ANTHROPIC_API_KEY — assertion logic validated against committed mock."
    );
    const mock = buildMock(registered);
    matches = mock.matches;
    console.log(
      `Mock: ${mock.reported.length} reported outcomes, ${matches.length} matches.`
    );
  }

  console.log("\nRunning oracle assertions:");
  const result = runAssertions(registered, matches);

  console.log(
    `\n${result.passed ? "ALL ASSERTIONS PASSED" : "ASSERTIONS FAILED"} (silently_added=${result.addedCount}).`
  );
  if (!result.passed) {
    console.error("\nFailures:\n  - " + result.failures.join("\n  - "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("checkFixture crashed:", err);
  process.exit(1);
});
