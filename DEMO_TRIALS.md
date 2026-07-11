# DEMO_TRIALS — outcome-guard

Version-controlled reference for the demo/backup trials the app is built and demoed against.
Each trial lists its registry link, results-paper link, and COMPare's reported
dropped/added outcome counts.

> **On the COMPare numbers below:** COMPare (compare-trials.org, Goldacre et al., 2015–16)
> published its per-trial findings as letters to the journals and on a JavaScript-rendered
> results site that cannot be scraped programmatically. Where a figure could **not** be
> verified from a primary source during setup, it is marked
> **`[TO TRANSCRIBE from COMPare letter]`** — fill it in by hand from the published COMPare
> correspondence / results page. Do not guess these numbers; they feed the test oracle.

---

## PRIMARY DEMO TRIAL — NCT01951625 (Vericiguat / SOCRATES-REDUCED)

| Field | Value |
| --- | --- |
| NCT ID | **NCT01951625** |
| Trial name | SOCRATES-REDUCED |
| Drug | Vericiguat (BAY1021189), soluble guanylate cyclase stimulator |
| Condition | Worsening chronic HF with reduced ejection fraction |
| Registry | https://clinicaltrials.gov/study/NCT01951625 |
| Registry API v2 | https://clinicaltrials.gov/api/v2/studies/NCT01951625?format=json |
| Results paper | Gheorghiade et al. *JAMA.* 2015;314(21):2251-2262 |
| Paper DOI | https://doi.org/10.1001/jama.2015.15734 |
| Paper access | **Paywalled (JAMA).** Text comes from the local PDF `demo-assets/NCT01951625.pdf`, **NOT** Europe PMC. |
| Registry fixture | `fixtures/registry.NCT01951625.json` (raw ClinicalTrials.gov v2 response) |
| Paper fixture | `fixtures/paper.NCT01951625.json` (Methods/Results extracted from the PDF) |

### COMPare reported counts (NCT01951625)

The paper was published online 2015-11-08 in JAMA, inside COMPare's monitoring window
(19 Oct – 30 Nov 2015) and in one of COMPare's five target journals, so it is a COMPare-tracked trial.

| Metric | Count |
| --- | --- |
| Prespecified outcomes correctly reported | `[TO TRANSCRIBE from COMPare letter]` |
| Prespecified outcomes **not reported** (silently dropped) | `[TO TRANSCRIBE from COMPare letter]` |
| **New** outcomes silently added | `[TO TRANSCRIBE from COMPare letter]` |

<!-- ============================================================================
     GROUND TRUTH — NCT01951625
     ============================================================================
     This is the TEST ORACLE. The matching engine (Prompt 3, Subagent B) checks
     itself against the exact outcome names below.

     STATUS OF THIS SECTION:
       - The "Registered outcomes (from the fixture)" list IS verified — it is
         transcribed directly from fixtures/registry.NCT01951625.json.
       - The "Dropped" / "Added" verdicts below are a DERIVED first pass, reasoned
         from the registry fixture + the paper text in fixtures/paper.NCT01951625.json.
         They must be RECONCILED against the exact COMPare letter before being
         treated as authoritative. Where they may differ from COMPare, that is
         called out. Transcribe COMPare's exact wording when filling the counts above.

     IMPORTANT CAVEAT ON THE LIVE REGISTRY:
       Registrations get edited over time. In the CURRENT fixture, every non-primary
       outcome sits in ClinicalTrials.gov's "otherOutcomes" bucket (there are zero
       "secondaryOutcomes"). COMPare compared the paper against the registry entry
       AS IT STOOD AT PUBLICATION. When transcribing the oracle, prefer the outcome
       set the COMPare letter actually used; note any divergence from today's fixture.
============================================================================ -->

### GROUND TRUTH — NCT01951625

**Registered outcomes (verbatim from `fixtures/registry.NCT01951625.json`):**

Primary:
1. Change From Baseline in Log-Transformed N-Terminal Pro-Brain Natriuretic Peptide (NT-proBNP) to Week 12 — *timeframe: Baseline, Week 12*

Secondary / other (registry "otherOutcomes" bucket in the current fixture):
2. Changes in Heart Function as Measured by Echocardiography: LVEDV and LVESV, Baseline→Week 12
3. Changes in Heart Function as Measured by Echocardiography: LVEF, Baseline→Week 12
4. Change From Baseline in Systolic and Diastolic Blood Pressure to Week 12
5. Change From Baseline in Heart Rate to Week 12
6. Number of Subjects With Clinical Events (HF Hospitalization and CV Mortality), Baseline→16 weeks
7. Number of Subjects With ICD/CRT-D Therapy, Baseline→16 weeks
8. Number of Subjects With Treatment-Emergent Adverse Events (safety)
9. Change in Biomarkers Baseline→Week 12: Osteopontin (ng/mL)
10. Change in Biomarkers Baseline→Week 12: TIMP-4 (pg/mL)
11. Change in Biomarkers Baseline→Week 12: cGMP (pmol/mL)
12. Change in Biomarkers Baseline→Week 12: PIIINP (mcg/L)
13. Change in Biomarkers Baseline→Week 12: GDF-15 (pg/mL)
14. Change in Biomarkers Baseline→Week 12: ST2 (pg/mL)
15. Change in Biomarkers Baseline→Week 12: Gal-3 (μg/mL)

**DROPPED — prespecified but not reported in the paper**
_(derived from paper text; reconcile with COMPare):_

- ICD/CRT-D therapy (registry #7) — no mention in Methods/Results of the paper.
- Prespecified biomarkers not reported: Osteopontin, TIMP-4, cGMP, PIIINP, GDF-15, ST2, Gal-3
  (registry #9–15). The paper's Methods say only "changes in multiple biomarker levels" and
  report none of these individually. **Note:** the paper does report the NT-proBNP biomarker
  (that is the primary), so "biomarkers" as a class is partially reported — the oracle should
  track each named biomarker separately.
- `[TO TRANSCRIBE: confirm which of the above COMPare counted as dropped, and its exact wording]`

**ADDED — reported in the paper but not prespecified in the registry**
_(derived from paper text; reconcile with COMPare):_

- `[TO TRANSCRIBE from COMPare letter — exact added-outcome names]`
- Candidate added outcomes observed in the paper's Results/Tables that are not a clean
  match to a registry entry (verify against COMPare before trusting):
  - Individual-dose pairwise comparisons of NT-proBNP (10-mg vs placebo, etc.) reported as
    exploratory findings.
  - Composite "CV death or HF hospitalization" broken out as a reported outcome (registry
    #6 bundles "HF hospitalization and CV mortality"; verify whether COMPare treated the
    paper's composite as the same outcome or a new one).

**KEY EDITORIAL OBSERVATION (the demo's punchline):**
The paper's Methods state: *"The primary end point of the study was change from baseline to
week 12 in log-transformed NT-proBNP level. **All additional end points were exploratory or
related to safety.**"* — i.e. the paper reframes every prespecified secondary outcome as merely
"exploratory," which is the mechanism by which prespecified outcomes were silently dropped /
demoted. This quote lives verbatim in `fixtures/paper.NCT01951625.json` ("Methods — Study End Points").

---

## BACKUP TRIAL 1 — NCT00784433 (CASCADE)

| Field | Value |
| --- | --- |
| NCT ID | **NCT00784433** |
| Trial name | CASCADE (CArdiovasCulAr Diabetes & Ethanol) |
| Registry | https://clinicaltrials.gov/study/NCT00784433 |
| Registry API v2 | https://clinicaltrials.gov/api/v2/studies/NCT00784433?format=json |
| Results paper | Gepner et al. *Ann Intern Med.* 2015 (initiating moderate wine consumption in type 2 diabetes) |
| Paper access | Verify open-access availability on Europe PMC before relying on it. |

### COMPare reported counts (NCT00784433)

| Metric | Count |
| --- | --- |
| Prespecified outcomes correctly reported | `[TO TRANSCRIBE from COMPare letter]` |
| Prespecified outcomes not reported (dropped) | `[TO TRANSCRIBE from COMPare letter]` |
| New outcomes silently added | `[TO TRANSCRIBE from COMPare letter]` |

---

## BACKUP TRIAL 2 — NCT01163032 (Tasimelteon)

> **⚠ TWO-TRIALS-IN-ONE-PAPER CAVEAT.** The Tasimelteon Non-24 program was reported in a
> single *Lancet* (2015) paper by Lockley et al. that covers **two** distinct trials:
> **SET** (the randomized efficacy trial) and **RESET** (the randomized-withdrawal trial).
> NCT01163032 is the SET trial; RESET has its own registration (NCT01429740). Any audit of
> this paper must decide which registration each reported outcome belongs to, and must not
> conflate SET's and RESET's prespecified outcomes. This is intentionally the hardest case —
> use it to test that the matching engine keeps two registries separate against one paper.

| Field | Value |
| --- | --- |
| NCT ID | **NCT01163032** (SET trial) |
| Companion NCT | NCT01429740 (RESET trial — same paper) |
| Trial name | SET (Non-24-Hour Sleep-Wake Disorder, tasimelteon vs placebo) |
| Registry (SET) | https://clinicaltrials.gov/study/NCT01163032 |
| Registry API v2 | https://clinicaltrials.gov/api/v2/studies/NCT01163032?format=json |
| Results paper | Lockley et al. *Lancet.* 2015 (tasimelteon for Non-24 in totally blind adults) |
| Paper access | Verify open-access availability on Europe PMC before relying on it. |

### COMPare reported counts (NCT01163032)

| Metric | Count |
| --- | --- |
| Prespecified outcomes correctly reported | `[TO TRANSCRIBE from COMPare letter]` |
| Prespecified outcomes not reported (dropped) | `[TO TRANSCRIBE from COMPare letter]` |
| New outcomes silently added | `[TO TRANSCRIBE from COMPare letter]` |

---

### Fixture / provenance notes

- `fixtures/registry.NCT01951625.json` — raw, unmodified ClinicalTrials.gov API v2 response.
- `fixtures/paper.NCT01951625.json` — Methods/Results extracted from `demo-assets/NCT01951625.pdf`
  (paywalled paper; extracted locally, not from Europe PMC).
- Backup-trial fixtures are not yet downloaded; add them if a backup is promoted to a live demo.
