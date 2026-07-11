/**
 * A mock AuditResult for the NCT01951625 (SOCRATES-REDUCED / Vericiguat) demo.
 *
 * This is DEMO-ONLY data. It is shaped exactly as the shared contract's
 * `AuditResult` and validated against `AuditResultSchema` at module load, so it
 * can never silently drift from the real type. It exists so the frontend can be
 * built and demoed without calling any LLM or network.
 *
 * Ground truth is transcribed from fixtures/registry.NCT01951625.json,
 * fixtures/paper.NCT01951625.json, and DEMO_TRIALS.md:
 *   - Primary NT-proBNP  -> reported_as_prespecified (green)
 *   - ICD/CRT-D + 7 named biomarkers -> silently_dropped (red)
 *   - Echo/BP/HR/clinical-events -> demoted to "exploratory" (warning)
 *   - Individual-dose pairwise + broken-out composite -> silently_added (amber)
 */
import { AuditResultSchema, type AuditResult } from "@/lib/contract";
import { computeIntegrityScore } from "@/lib/report/score";

const mock: AuditResult = {
  trialRecord: {
    nctId: "NCT01951625",
    title:
      "Effect of Vericiguat on Natriuretic Peptide Levels in Patients With Worsening Chronic Heart Failure and Reduced Ejection Fraction (SOCRATES-REDUCED)",
    status: "Completed",
    registeredOutcomes: [
      // 0 — primary
      {
        measure:
          "Change From Baseline in Log-Transformed N-Terminal Pro-Brain Natriuretic Peptide (NT-proBNP) to Week 12",
        timeFrame: "Baseline, Week 12",
        type: "primary",
        sourceType: "primary",
      },
      // 1 — LVEDV / LVESV
      {
        measure:
          "Changes in Heart Function as Measured by Echocardiography: LVEDV and LVESV From Baseline to Week 12",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      // 2 — LVEF
      {
        measure:
          "Changes in Heart Function as Measured by Echocardiography: LVEF From Baseline to Week 12",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      // 3 — BP
      {
        measure:
          "Change From Baseline in Systolic and Diastolic Blood Pressure to Week 12",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      // 4 — HR
      {
        measure: "Change From Baseline in Heart Rate to Week 12",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      // 5 — clinical events composite
      {
        measure:
          "Number of Subjects With Clinical Events (HF Hospitalization and CV Mortality)",
        timeFrame: "Baseline until 16 weeks",
        type: "secondary",
        sourceType: "other",
      },
      // 6 — ICD/CRT-D
      {
        measure:
          "Number of Subjects With ICD/CRT-D (Implantable Cardioverter Defibrillator / Cardiac Resynchronization Therapy With Defibrillation) Therapy",
        timeFrame: "Baseline up to 16 weeks",
        type: "secondary",
        sourceType: "other",
      },
      // 7 — TEAEs (safety)
      {
        measure: "Number of Subjects With Treatment-Emergent Adverse Events",
        timeFrame:
          "From start of study treatment up to 5 days after the last dose",
        type: "secondary",
        sourceType: "other",
      },
      // 8..14 — named biomarkers
      {
        measure:
          "Change in Biomarkers From Baseline to Week 12: Osteopontin (ng/mL)",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      {
        measure:
          "Change in Biomarkers From Baseline to Week 12: TIMP-4 (pg/mL)",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      {
        measure:
          "Change in Biomarkers From Baseline to Week 12: cGMP (pmol/mL)",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      {
        measure:
          "Change in Biomarkers From Baseline to Week 12: PIIINP (mcg/L)",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      {
        measure:
          "Change in Biomarkers From Baseline to Week 12: GDF-15 (pg/mL)",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      {
        measure: "Change in Biomarkers From Baseline to Week 12: ST2 (pg/mL)",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
      {
        measure:
          "Change in Biomarkers From Baseline to Week 12: Gal-3 (μg/mL)",
        timeFrame: "Baseline, Week 12",
        type: "secondary",
        sourceType: "other",
      },
    ],
    resultPublicationRefs: [
      {
        citation:
          "Gheorghiade M, et al. Effect of Vericiguat on Natriuretic Peptide Levels... The SOCRATES-REDUCED Randomized Trial. JAMA. 2015;314(21):2251-2262.",
        pmid: "26547357",
        doi: "10.1001/jama.2015.15734",
        url: "https://doi.org/10.1001/jama.2015.15734",
      },
    ],
  },

  reportedOutcomes: [
    // 0 — primary NT-proBNP (faithful)
    {
      measure:
        "Change from baseline to week 12 in log-transformed NT-proBNP level",
      verbatimQuote:
        "The primary end point of the study was change from baseline to week 12 in log-transformed NT-proBNP level.",
      section: "Methods — Study End Points",
    },
    // 1 — LVEF (reported, but framed exploratory -> demoted)
    {
      measure: "Change in LVEF from baseline to week 12",
      verbatimQuote:
        "LVEF, %: Placebo 1.52; 2.5–10 mg 3.68, diff 2.17 (0.33 to 4.00), P=.02.",
      section: "Results — Table 4",
    },
    // 2 — LVEDV/LVESV (reported, exploratory -> demoted)
    {
      measure: "Change in LVEDV and LVESV from baseline to week 12",
      verbatimQuote:
        "LVEDV, mL: Placebo −7.26; 2.5–10 mg −7.32, diff −0.07 (−12.28 to 12.15), P=.99. LVESV, mL: Placebo −6.83; 2.5–10 mg −11.02, diff −4.19 (−14.04 to 5.67), P=.40.",
      section: "Results — Table 4",
    },
    // 3 — BP (reported, exploratory -> demoted)
    {
      measure: "Change in systolic and diastolic blood pressure to week 12",
      verbatimQuote:
        "Systolic BP, mm Hg: Placebo −5.14; 2.5–10 mg −5.64, diff −0.50 (−5.14 to 4.15), P=.83. Diastolic BP, mm Hg: ... diff 0.13 (−3.02 to 3.28), P=.94.",
      section: "Results — Table 4",
    },
    // 4 — HR (reported, exploratory -> demoted)
    {
      measure: "Change in heart rate to week 12",
      verbatimQuote:
        "Heart rate, /min: Placebo −0.56; 2.5–10 mg 0.55, diff 1.11 (−2.74 to 4.96), P=.57.",
      section: "Results — Table 4",
    },
    // 5 — clinical events (reported as exploratory -> demoted)
    {
      measure:
        "All-cause death, CV death, HF hospitalization (clinical events) up to week 12",
      verbatimQuote:
        "All-cause death at 12 weeks occurred at a rate of 3.3% among patients taking placebo and 2.2% to 4.4% among patients randomized to receive vericiguat.",
      section: "Results — Exploratory End Points",
    },
    // 6 — ADDED: individual-dose pairwise NT-proBNP
    {
      measure:
        "Pairwise comparison of NT-proBNP change: 10-mg vericiguat vs placebo",
      verbatimQuote:
        "Pairwise exploratory analyses of individual vericiguat groups found differences in the primary end point between the 10-mg vericiguat group ... and placebo ... (difference of means, −0.250; 90% CI, −0.50 to 0.00; ... P = .048).",
      section: "Results — Exploratory End Points",
    },
    // 7 — ADDED: dose-response linear regression
    {
      measure: "Dose-response relationship of NT-proBNP reduction (linear regression)",
      verbatimQuote:
        "Exploratory secondary analyses of the primary end point using linear regression modeling suggested a dose-response relationship (P < .02), with higher vericiguat doses associated with greater reduction in NT-proBNP levels.",
      section: "Results — Primary End Point",
    },
    // 8 — ADDED: broken-out composite CV death or HF hospitalization
    {
      measure:
        "Composite of cardiovascular death or HF hospitalization (broken out by dose)",
      verbatimQuote:
        "The rate of the composite of cardiovascular death or HF hospitalization was 11% in the 10-mg vericiguat group, 12.1% in the 5-mg group ... and 19.6% in the placebo group.",
      section: "Results — Exploratory End Points",
    },
  ],

  matches: [
    // GREEN — primary reported faithfully
    {
      registeredRef: 0,
      reportedRef: 0,
      classification: "reported_as_prespecified",
      confidence: 0.98,
      rationale:
        "The prespecified primary end point (log-transformed NT-proBNP change to week 12) is reported verbatim as the paper's primary end point, at the same time frame.",
    },

    // RED — ICD/CRT-D dropped
    {
      registeredRef: 6,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.95,
      rationale:
        "Registered ICD/CRT-D therapy outcome appears nowhere in the paper's Methods, Results, or tables. No verbatim mention was found.",
    },
    // RED — 7 named biomarkers dropped
    {
      registeredRef: 8,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.92,
      rationale:
        "Prespecified biomarker Osteopontin is not reported. Methods only say 'changes in multiple biomarker levels' without reporting this measure.",
    },
    {
      registeredRef: 9,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.92,
      rationale:
        "Prespecified biomarker TIMP-4 is not reported anywhere in the paper.",
    },
    {
      registeredRef: 10,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.92,
      rationale:
        "Prespecified biomarker cGMP is not reported anywhere in the paper.",
    },
    {
      registeredRef: 11,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.92,
      rationale:
        "Prespecified biomarker PIIINP is not reported anywhere in the paper.",
    },
    {
      registeredRef: 12,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.92,
      rationale:
        "Prespecified biomarker GDF-15 is not reported anywhere in the paper.",
    },
    {
      registeredRef: 13,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.92,
      rationale:
        "Prespecified biomarker ST2 is not reported anywhere in the paper.",
    },
    {
      registeredRef: 14,
      reportedRef: null,
      classification: "silently_dropped",
      confidence: 0.92,
      rationale:
        "Prespecified biomarker Gal-3 is not reported anywhere in the paper.",
    },

    // WARNING (demoted) — prespecified secondaries reframed as "exploratory"
    {
      registeredRef: 2,
      reportedRef: 1,
      classification: "demoted",
      confidence: 0.85,
      rationale:
        "LVEF was prespecified as an echocardiographic end point but the paper reframes it as merely 'exploratory' ('All additional end points were exploratory or related to safety'), demoting it below its registered status.",
    },
    {
      registeredRef: 1,
      reportedRef: 2,
      classification: "demoted",
      confidence: 0.83,
      rationale:
        "LVEDV/LVESV were prespecified echocardiographic outcomes but reported only as descriptive 'exploratory' end points with P values stated as non-inferential.",
    },
    {
      registeredRef: 3,
      reportedRef: 3,
      classification: "demoted",
      confidence: 0.8,
      rationale:
        "Blood pressure was prespecified but is reported only in Table 4 as an exploratory vital-sign end point.",
    },
    {
      registeredRef: 4,
      reportedRef: 4,
      classification: "demoted",
      confidence: 0.8,
      rationale:
        "Heart rate was prespecified but reported only as an exploratory vital-sign end point.",
    },
    {
      registeredRef: 5,
      reportedRef: 5,
      classification: "demoted",
      confidence: 0.78,
      rationale:
        "The prespecified clinical-events composite (HF hospitalization + CV mortality) is reported only under 'Exploratory End Points' with descriptive P values, demoting a registered secondary.",
    },

    // AMBER (silently_added) — reported but never prespecified
    {
      registeredRef: null,
      reportedRef: 6,
      classification: "silently_added",
      confidence: 0.9,
      rationale:
        "Pairwise 10-mg-vs-placebo comparison of NT-proBNP is a per-dose analysis reported as a finding but was not a prespecified outcome in the registry.",
    },
    {
      registeredRef: null,
      reportedRef: 7,
      classification: "silently_added",
      confidence: 0.82,
      rationale:
        "The dose-response linear-regression analysis is presented as a result but does not correspond to any registered outcome measure.",
    },
    {
      registeredRef: null,
      reportedRef: 8,
      classification: "silently_added",
      confidence: 0.7,
      rationale:
        "The composite of 'CV death or HF hospitalization' is broken out and reported by dose group; the registry bundles clinical events differently, so this reported breakout is effectively a new outcome.",
    },
  ],

  // Filled in below from the canonical scorer so the gauge, the letter, and the
  // score function can never disagree. (Placeholder; overwritten before export.)
  integrityScore: 0,

  metadata: {
    registrySource: "fixtures/registry.NCT01951625.json",
    paperSource: "pdf:demo-assets/NCT01951625.pdf",
    model: "mock-demo (no LLM call)",
    generatedAt: "2026-07-11T00:00:00.000Z",
    notes:
      "Demo mock for SOCRATES-REDUCED. Illustrative classifications; reconcile against the COMPare letter for authoritative counts.",
  },
};

// Derive the integrity score from the canonical scorer (single source of truth)
// so the demo's gauge and letter agree with src/lib/report/score.ts, rather than
// carrying a hand-picked constant that could contradict the scorer.
mock.integrityScore = computeIntegrityScore(mock);

/**
 * Validate at module load so the mock can never drift from the contract.
 * `AuditResultSchema.parse` throws loudly if the shape is wrong.
 */
export const mockAudit: AuditResult = AuditResultSchema.parse(mock);
