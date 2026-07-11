# BUILDLOG — outcome-guard

A running log of work done on this project. **Append a new entry after every task.**

Entry format (copy this for every future entry):

```
## [YYYY-MM-DD HH:MM] <short task title>
- What was done:
- Files created/changed:
- Key decisions / assumptions:
- How to verify it works:
- What's next / open issues:
```

---

## [2026-07-11 14:59] Project setup: Next.js 15 + AI SDK v6
- What was done:
  - Scaffolded a Next.js 15 App Router project (TypeScript, Tailwind CSS, ESLint, `src/`
    directory, `@/*` import alias) into the existing repo, preserving `.git`, the original
    `README.md`, and `demo-assets/`.
  - Installed the Vercel AI SDK v6 (`ai`), the Anthropic provider (`@ai-sdk/anthropic`),
    and `zod`.
  - Authored `CLAUDE.md` (project conventions) and this `BUILDLOG.md`.
- Files created/changed:
  - Added: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`,
    `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts`, `.gitignore`,
    `src/app/{layout.tsx,page.tsx,globals.css,favicon.ico}`, `public/*`.
  - Added: `CLAUDE.md`, `BUILDLOG.md`.
  - Edited: `AGENTS.md` (replaced the create-next-app Next.js-16 warning; we are on 15),
    `CLAUDE.md` (was a `@AGENTS.md` stub).
  - Preserved: `README.md`, `demo-assets/NCT01951625.pdf`, `.git`.
- Key decisions / assumptions:
  - `create-next-app@latest` installs Next.js **16** by default; the task requires **15**,
    so Next and `eslint-config-next` were pinned to `^15` (resolved to Next 15.5.20).
    React 19 is retained (compatible with Next 15).
  - Scaffolded into a temp dir and merged files in, rather than running create-next-app in
    place, so existing repo files were not clobbered by the generator.
  - Package name set to `outcome-guard`.
  - `src/lib/contract/` (the read-only shared-types dir) is defined as a convention in
    CLAUDE.md but not yet created — it will be added when the first shared type is written.
- How to verify it works:
  - `npm run dev` starts the app at http://localhost:3000 and renders the default page.
  - `npm run build` completes successfully.
  - `npm ls next ai @ai-sdk/anthropic zod` shows next@15.x, ai@6.x, @ai-sdk/anthropic, zod.
- What's next / open issues:
  - Create `src/lib/contract/` with the shared domain types (ClinicalTrials.gov v2 and
    Europe PMC shapes).
  - Add the direct-fetch data-access layer for ClinicalTrials.gov API v2 and Europe PMC.
  - Wire up the first AI SDK v6 route using the Anthropic provider.

## [2026-07-11 15:08] Shared data contract + NCT01951625 demo fixtures
- What was done:
  - Built the shared Zod-based data contract in `src/lib/contract/` (types inferred
    from schemas so runtime and compile-time shapes cannot drift): RegisteredOutcome,
    ReportedOutcome, OutcomeMatch, TrialRecord (+ PublicationRef), AuditResult
    (+ AuditMetadata), and the OutcomeClassification enum.
  - Fetched the live ClinicalTrials.gov API v2 response for NCT01951625 and saved it raw
    to `fixtures/registry.NCT01951625.json` (HTTP 200, 122 KB).
  - Extracted the Methods/Results text from `demo-assets/NCT01951625.pdf` (paywalled JAMA
    paper — extracted locally with pdfjs-dist, NOT from Europe PMC) into
    `fixtures/paper.NCT01951625.json` as labeled sections with a verbatim quote of the key
    "all additional end points were exploratory" sentence.
  - Wrote `DEMO_TRIALS.md`: primary trial NCT01951625 (Vericiguat/SOCRATES-REDUCED) plus
    backups NCT00784433 (CASCADE) and NCT01163032 (Tasimelteon SET, with the two-trials-in-
    one-paper caveat and its companion NCT01429740/RESET). Includes a clearly-marked
    GROUND TRUTH oracle section under NCT01951625.
- Files created/changed:
  - Added: `src/lib/contract/{index,outcomes,match,trial,audit}.ts`.
  - Added: `fixtures/registry.NCT01951625.json`, `fixtures/paper.NCT01951625.json`.
  - Added: `DEMO_TRIALS.md`.
- Key decisions / assumptions:
  - Contract split across small files with a barrel `index.ts`; feature code imports from
    `@/lib/contract`. RegisteredOutcome.type is two-valued (primary|secondary) per the spec,
    with an optional `sourceType` preserving the raw registry bucket (primary/secondary/other)
    since ClinicalTrials.gov v2 files SOCRATES-REDUCED's non-primary outcomes under
    `otherOutcomes`.
  - OutcomeMatch refs are indices into the AuditResult arrays and are nullable on one side
    (dropped → no reportedRef; added → no registeredRef); a `.refine` rejects both-null.
  - COMPare's per-trial counts could not be scraped (JS-rendered SPA / letters). Rather than
    fabricate the oracle, the exact dropped/added COUNTS are left as `[TO TRANSCRIBE from
    COMPare letter]` placeholders (12 of them). The GROUND TRUTH registered-outcome list IS
    verified (transcribed from the registry fixture); the dropped/added verdicts are a DERIVED
    first pass to be reconciled with the COMPare letter.
- How to verify it works:
  - `npx tsc --noEmit` and `npm run lint` both pass clean.
  - Ran a runtime smoke test (`tsx`): AuditResultSchema validates a sample audit, the
    both-null OutcomeMatch is rejected, and both fixtures import/parse.
  - `test -s fixtures/registry.NCT01951625.json` → non-empty (122 KB), valid JSON,
    nctId=NCT01951625. `fixtures/paper.NCT01951625.json` → 6 sections. `DEMO_TRIALS.md`
    exists with the "GROUND TRUTH — NCT01951625" section.
- What's next / open issues:
  - Transcribe the 12 `[TO TRANSCRIBE]` COMPare figures + exact added/dropped outcome names
    into DEMO_TRIALS.md from the published COMPare correspondence (feeds the test oracle).
  - Reconcile the derived GROUND TRUTH dropped/added verdicts against the registration as it
    stood at publication (today's fixture has all non-primary outcomes in `otherOutcomes`).
  - Build the registry-normalization layer that maps the raw ClinicalTrials.gov v2 study into
    TrialRecord, and the paper→ReportedOutcome extraction (Prompt 3, Subagent B matching engine).

## [2026-07-11 15:20] Data ingestion track (src/lib/ingest)
- What was done:
  - Built the ingestion layer that turns external sources into contract types:
    ClinicalTrials.gov v2 -> `TrialRecord`, and Europe PMC -> results-paper text.
    Added a graceful uploaded-PDF fallback. Verified against the live APIs on 3 NCT ids.
- Files created/changed:
  - Added: `src/lib/ingest/clinicaltrials.ts` (`getTrial`), `src/lib/ingest/europepmc.ts`
    (`getPaperText`), `src/lib/ingest/pdf.ts` (`pdfToText`), `src/lib/ingest/HANDOFF.md`.
- Key decisions / assumptions:
  - `primaryOutcomes`->type "primary"; `secondaryOutcomes` and `otherOutcomes`->type
    "secondary", with the raw bucket kept in `sourceType`. `getTrial` runs
    `TrialRecordSchema.parse` so bad data fails loudly.
  - Result refs: type "RESULT" preferred; fall back to "DERIVED" only when no RESULT exists.
  - Europe PMC: PMID full-text XML first (MED), else search by NCT id then title; reduce
    JATS to Methods+Results `<sec>`s (tag-stripped); abstract fallback when no OA full text.
  - No `pdfjs-dist`/`pdf-parse` in package.json and adding a dep is out of this track's
    scope, so `pdfToText` validates the `%PDF-` header then throws a clear
    "requires pdfjs-dist/pdf-parse; not installed" error (demo uses the pre-extracted fixture).
  - Native `fetch` only; small User-Agent header; non-200 throws with status + body snippet.
- How to verify it works:
  - `npx tsx <scratchpad>/prove.ts` — all 3 succeed live:
    NCT01951625 COMPLETED, 15 outcomes (1P/14S), 2 refs, PMID 25056511;
    NCT00784433 COMPLETED, 2 outcomes (1P/1S), 3 refs, PMID 27692023;
    NCT01163032 COMPLETED, 12 outcomes (2P/10S), 1 ref, PMID 26466871.
    `getPaperText({pmid:"25056511"})` returned abstract (1143 chars) — no OA full text for that PMID.
  - `npx tsc --noEmit`: 0 errors in src/lib/ingest (only pre-existing error is in src/lib/engine).
- What's next / open issues:
  - When a PDF lib is added, wire it into `pdf.ts` via dynamic import.
  - Europe PMC full-text path is exercised but this demo PMID is abstract-only; PMC-indexed
    papers will return Methods+Results full text.

## [2026-07-11 15:22] Scoring + letter track (src/lib/report)
- What was done:
  - Built the integrity scorer and the COMPare-style letter generator, both
    importing types from `@/lib/contract`. Scorer is pure/deterministic; letter
    runs fully offline via a deterministic template fallback and upgrades to the
    Anthropic AI SDK when a key is present.
- Files created/changed:
  - Added: `src/lib/report/score.ts` (`computeIntegrityScore`, `scoreBreakdown`,
    exported `PENALTY` constants), `src/lib/report/letter.ts` (`generateLetter`,
    `renderTemplateLetter`), `src/lib/report/HANDOFF.md`.
- Key decisions / assumptions:
  - Additive-penalty model off a 100 baseline, clamped [0,100]. Weights (points):
    DROPPED_PRIMARY 60 (a single dropped primary alone tanks the score),
    DROPPED_SECONDARY 12, SILENTLY_ADDED 10, DEMOTED/PROMOTED 8, TIMEFRAME_CHANGED 5;
    +1 credit per faithfully-reported outcome. Dropped-primary detection looks up
    `match.registeredRef` -> `trialRecord.registeredOutcomes[ref].type === "primary"`.
  - `generateLetter` detects `process.env.ANTHROPIC_API_KEY`; with no key (or on any
    AI-SDK error) it returns the template letter, so it always works offline. The
    AI SDK is dynamically imported so the offline path never loads it.
  - Cast the anthropic() model through `unknown` to core's param type: installed
    ai@6 types `model` against provider spec v2/v3 while @ai-sdk/anthropic@4 emits
    spec v4 — a peer-version mismatch in this env; runtime shapes are compatible and
    that path only runs when a key is set.
- How to verify it works:
  - `npx tsc --noEmit` -> 0 errors in src/lib/report.
  - Scratchpad proof (mock NCT01951625 audit, AuditResultSchema-validated) prints the
    weighting proof: drop ONE secondary only -> 89; drop ONE primary only -> 40; full
    demo audit (primary faithful, 4 secondaries dropped, 1 added) -> 43; same audit with
    the primary ALSO dropped -> 0. Template letter renders with real counts, the dropped
    list, and the added outcome's verbatim quote.
- What's next / open issues:
  - UI (Track E/app) can call `scoreBreakdown` to render the per-bucket explanation and
    `generateLetter` for the letter panel. Penalty weights are tunable named constants.

## Subagent C — Frontend / demo UI (2026-07-11 15:22)
- Built demo page (src/app/page.tsx -> src/components/DemoApp.tsx) with NCT-id paste input + 'Load demo trial (NCT01951625)' button.
- Added OutcomeLedger.tsx (streaming color-coded rows w/ expandable verbatim evidence) and ScoreGauge.tsx (animated 0-100 integrity arc).
- Added mockAudit.ts (contract-validated AuditResult: 15 registered, 17 matches, integrityScore 34) + outcomePresentation.ts (classification color/label/penalty helper).
- Added minimal additive fadeIn keyframe to globals.css. tsc --noEmit clean for src/app + src/components; next build 'Compiled successfully' (only pre-existing src/lib/engine type errors block full build, outside my boundary).

## [2026-07-11 15:30] Extraction & matching engine (src/lib/engine)
- What was done:
  - Built the core engine: `extractReported` (Sonnet, generateObject) pulls reported
    outcomes from paper text with VERBATIM quotes; `matchOutcomes` (Opus, generateObject)
    aligns registered vs reported and classifies each per the OutcomeClassification enum
    with confidence + rationale; `runEngine` chains them. All output validated with
    OutcomeMatchSchema/ReportedOutcomeSchema; matcher also range-checks refs.
  - Wrote a fixture check that derives RegisteredOutcome[] from the registry fixture
    (1 primary + 14 otherOutcomes->secondary), runs extract->match, and asserts a DERIVED
    self-consistent oracle. Degrades gracefully with no ANTHROPIC_API_KEY via a committed
    mock so the assertion logic itself is exercised offline.
- Files created/changed:
  - Added: src/lib/engine/{extractReported.ts, matchOutcomes.ts, checkFixture.ts, HANDOFF.md}.
- Key decisions / assumptions:
  - Matcher system prompt teaches renamed (semantic, not string), composite/split/overlap
    (registry "HF Hospitalization and CV Mortality" bundle <-> paper "CV death or HF
    hospitalization" composite -> reported_as_prespecified, not drop+add), and timeframe
    (concept matches, time frame differs -> timeframe_changed) cases with examples.
  - Derived oracle (NOT COMPare's unverified ~28): (a) ICD/CRT-D silently_dropped;
    (b) 7 named biomarkers (Osteopontin, TIMP-4, cGMP, PIIINP, GDF-15, ST2, Gal-3)
    silently_dropped; (c) NT-proBNP primary reported_as_prespecified; (d) silently_added
    count >= 8 (actual count LOGGED, not hard-asserted to 28). Oracle resolves registry
    indices by measure-text substring (registry writes "NTproBNP"; needle "proBNP").
  - Same @ai-sdk/anthropic@4 (spec v4) vs ai@6 (spec v3) version mismatch as report/letter.ts:
    cast anthropic(model) through `unknown` to generateObject's model param. Type-clean; but
    the LIVE path needs the provider aligned to @ai-sdk/anthropic@3.x or it throws
    UnsupportedModelVersionError at runtime (flagged in HANDOFF for whoever owns deps).
- How to verify it works:
  - `npx tsc --noEmit` -> 0 errors (whole project clean now).
  - `npx tsx src/lib/engine/checkFixture.ts` (no key) -> exits 0, all oracle assertions PASS,
    logs "silently_added count = 8".
- What's next / open issues:
  - Align @ai-sdk/anthropic to ^3 (matches ai@6) so the live extract->match path runs;
    then re-run checkFixture WITH a key to validate the real model output against the oracle.
  - COMPare's exact added/dropped names + counts still [TO TRANSCRIBE] in DEMO_TRIALS.md.

## [2026-07-11 15:27] Four-track parallel build + integration (ingest/engine/UI/report)
- What was done:
  - Ran four subagents in parallel, each confined to its own directory, importing
    the read-only contract from `src/lib/contract/`:
    - A — `src/lib/ingest/` (clinicaltrials.ts, europepmc.ts, pdf.ts); proven live on
      NCT01951625 / NCT00784433 / NCT01163032.
    - B — `src/lib/engine/` (extractReported.ts w/ claude-sonnet-5, matchOutcomes.ts w/
      claude-opus-4-8, checkFixture.ts); fixture check passes offline.
    - C — `src/app/` + `src/components/` (DemoApp, OutcomeLedger, ScoreGauge, mockAudit).
    - D — `src/lib/report/` (score.ts, letter.ts).
  - Integration pass (done by the orchestrator, outside subagent boundaries):
    - Fixed a real dependency mismatch all four tracks hit: `@ai-sdk/anthropic@4`
      emits provider-spec v4 models but `ai@6` expects spec v3, so the live LLM path
      would throw `UnsupportedModelVersionError`. Pinned the provider to
      `@ai-sdk/anthropic@^3` (3.0.96, provider-spec v3) and removed the three
      `as unknown as` casts the subagents used to paper over it; the models now type
      against `generateObject`/`generateText` natively.
    - Made `mockAudit.integrityScore` derive from `computeIntegrityScore` (D's scorer)
      instead of a hard-coded 34, so the gauge, letter, and scorer can't disagree.
    - Refreshed two stale HANDOFF notes (engine: provider now aligned; components:
      score derived).
- Files created/changed:
  - Added (subagents): src/lib/ingest/*, src/lib/engine/*, src/lib/report/*,
    src/components/*, and each track's HANDOFF.md; edited src/app/page.tsx and a
    minimal additive keyframe in src/app/globals.css.
  - Changed (integration): package.json / package-lock.json (@ai-sdk/anthropic ^3),
    src/lib/engine/extractReported.ts, src/lib/engine/matchOutcomes.ts,
    src/lib/report/letter.ts (casts removed), src/components/mockAudit.ts (derived
    score), src/lib/engine/HANDOFF.md, src/components/HANDOFF.md.
- Key decisions / assumptions:
  - Provider pinned to ^3 rather than upgrading `ai` — ^3 is the major that pairs with
    ai@6; this restores real type-safety on the model argument (no casts).
  - The demo mock scores 0/100: 8 dropped secondaries (×12) alone exceed the 100-point
    budget, so the SOCRATES-REDUCED demo bottoms out. This is a faithful (if stark)
    result, not a bug — the gauge still animates 100→0 as rows stream in.
  - No ANTHROPIC_API_KEY in this environment: ingestion needs none; the engine fixture
    check and the letter both run offline (mock / template fallback). Live LLM paths are
    type-correct and will run when a key is present.
- How to verify it works:
  - `npx tsc --noEmit` → clean (0 errors, no casts).
  - `npm run build` → Compiled successfully; `npm start` serves `/` 200 with the demo
    button + ledger + gauge in the HTML.
  - `npx tsx src/lib/engine/checkFixture.ts` → ALL ASSERTIONS PASSED (ICD/CRT-D + 7
    biomarkers silently_dropped, NT-proBNP faithful, 8 silently_added).
  - `npm run lint` → clean.
- What's next / open issues:
  - Wire the UI's "Audit" button + non-demo NCT ids to a real route that chains
    ingest.getTrial → engine.runEngine → report.computeIntegrityScore/generateLetter
    (needs ANTHROPIC_API_KEY server-side).
  - Add a PDF library (pdfjs-dist) so ingest.pdfToText works for uploaded papers.
  - Transcribe the COMPare oracle (still [TO TRANSCRIBE] in DEMO_TRIALS.md) and add the
    two backup trials' fixtures if promoted to live demos.

## [2026-07-11 15:37] Saturating integrity score (fix score collapse to 0)
- What was done:
  - Rewrote `computeIntegrityScore`/`scoreBreakdown` in src/lib/report/score.ts from
    linear-stacking flat penalties (which blew the 100-pt budget — 8 dropped secondaries
    × 12 = 96, everything bad saturated to 0) to SATURATING per-category penalties with
    diminishing returns, so scores spread across a usable range and ordering is preserved.
  - Model: score = round(max(0, 100 − 60·sat(droppedPrimary,k=1) − 75·sat(droppedSecondary,k=4)
    − 20·sat(added,k=6))), where sat(n,k)=1−exp(−n/k).
  - Added `saturate()` as an exported pure helper; `scoreBreakdown` now returns the three
    penalty `terms` (each with count/weight/k/points) plus raw and folded counts.
  - Added unit tests (src/lib/report/score.test.ts) via Node's built-in node:test (no new
    dep): clean→100, one dropped primary→~62, two primaries→48, demo→20, fully-switched→0,
    saturation/ordering/folding invariants, breakdown shape. All 10 pass.
  - Updated src/lib/report/letter.ts footer (removed the now-gone totalReward; summarizes the
    three terms) and src/lib/report/HANDOFF.md for the new breakdown shape.
- Files created/changed:
  - Rewrote: src/lib/report/score.ts.
  - Added: src/lib/report/score.test.ts.
  - Edited: src/lib/report/letter.ts (footer), src/lib/report/HANDOFF.md.
- Key decisions / assumptions (both confirmed with the user):
  - The spec defined only 3 penalty terms; the mild switches (demoted/promoted/
    timeframe_changed) are FOLDED so no discrepancy is free — demoted → dropped-secondary-
    equivalent, promoted/timeframe_changed → added-equivalent.
  - The spec's stated k-values mathematically produced ~57–63 for the demo, not the prose
    target of "high-teens/low-20s". Per the user's "retune to hit high-teens" decision, the
    secondary weight/k were retuned (Wsec=75, ksec=4; added Wadd=20, kadd=6; primary
    unchanged at 60/k=1) so the real demo mock (0 dropped primary, 8 dropped secondary +
    5 demoted = 13 folded, 3 added) lands at exactly 20 while keeping the other anchors
    (clean=100, one primary=62, two primaries=48, fully-switched=0).
  - No test-runner dependency added (would touch out-of-scope config); tests run under
    `npx tsx --test`, matching the engine track's runnable-check convention.
- How to verify it works:
  - `npx tsx --test src/lib/report/score.test.ts` → 10/10 pass.
  - Real demo: `mockAudit.integrityScore` (derived) = 20; letter footer shows the term
    breakdown. `npx tsc --noEmit` clean, `npm run build` compiles, `npm run lint` clean,
    engine fixture check still green.
- What's next / open issues:
  - If the UI wants to visualize the breakdown, it can now render `scoreBreakdown().terms`.
  - k-values are demo-tuned; revisit once real (non-mock) audits and the transcribed COMPare
    oracle exist, to confirm the band feels right across trials.

## [2026-07-11 15:54] Live streaming audit route + UI wired to real pipeline
- What was done:
  - Added a streaming audit API and connected the UI to it, replacing the mock as
    the default path (mock kept as an explicit offline fallback).
  - Contract: added `AuditEvent` (discriminated union of the staged streaming
    events) + `AuditRequest` in src/lib/contract/events.ts, and a structural
    `ScoreBreakdownLike` in src/lib/contract/score-shape.ts so the contract can
    carry a score breakdown WITHOUT importing the feature-layer scorer (keeps the
    contract's read-only, no-reverse-dependency rule). Exported both from the barrel.
  - Route: src/app/api/audit/route.ts — POST { nctId, paperSource?, pdfBase64? }
    returns a ReadableStream of newline-delimited JSON AuditEvents. Pipeline:
    getTrial → resolve paper → extractReported (Sonnet 5) → matchOutcomes (Opus 4.8)
    → computeIntegrityScore/scoreBreakdown → validate AuditResult → done. Emits
    registry / paper / extracting / reported / matching / one `match` per
    OutcomeMatch / scored / done / error. Node runtime; ANTHROPIC_API_KEY read
    server-side only and guarded up front with a clean error.
  - Paper source: demo trial NCT01951625 loads fixtures/paper.NCT01951625.json from
    disk (no network); any other id uses Europe PMC (registry PMID → full text →
    abstract fallback). `paperSource: "fixture"|"europepmc"|"pdf"` overrides.
  - UI: new useAuditStream hook consumes the NDJSON stream and builds state
    incrementally; OutcomeLedger gained a STREAMED mode (parent-controlled rows, no
    timer) alongside the existing TIMER mode; DemoApp now runs live by default,
    streams ledger rows + a live gauge, keeps an "Offline demo" checkbox for the
    mock, and shows dismissible error banners for every failure path. The
    "reviewer aid, not a verdict" note + per-row confidence stay visible.
- Files created/changed:
  - Added: src/app/api/audit/route.ts, src/components/useAuditStream.ts,
    src/lib/contract/events.ts, src/lib/contract/score-shape.ts.
  - Edited: src/components/DemoApp.tsx, src/components/OutcomeLedger.tsx,
    src/lib/contract/index.ts, src/components/HANDOFF.md.
- Key decisions / assumptions:
  - matchOutcomes resolves all matches in ONE Opus call, so the per-`match` events
    are fanned out from the returned array (rows still stream into the ledger one by
    one) — the model does not stream partial matches. Noted honestly.
  - The contract must not depend on feature code, so ScoredEvent carries the loose
    `ScoreBreakdownLike`; the real `ScoreBreakdown` is assignable to it (asserted).
  - `next start` does not auto-load .env.local; for local verification the key was
    sourced into the process env. On Vercel/hosting, set ANTHROPIC_API_KEY as a
    server env var.
- How to verify it works (all run):
  - Live demo end-to-end WITH the key: POST {nctId:"NCT01951625"} streamed 34 events
    — registry (15 outcomes, live), paper (fixture, 5970 chars), reported 18, 27
    matches, scored = 20, done = 20/100. The real engine flagged ICD/CRT-D + all 7
    named biomarkers as silently_dropped and the exploratory pairwise/dose-response
    + all-cause-death breakouts as silently_added — matching DEMO_TRIALS GROUND TRUTH.
  - Europe PMC path: POST {nctId:"NCT00784433"} resolved via registry PMID, full
    text not open-access so it degraded cleanly to the ABSTRACT (1732 chars),
    extracted 10, matched 11, scored 67. Abstract-only is weaker but does not crash.
  - Failure paths: nonexistent NCT → error{failedStage:"registry"}; invalid id →
    clean error; missing ANTHROPIC_API_KEY → "use the offline demo" error, no SDK crash.
  - Offline mock still renders and scores 20; engine fixture check still green.
  - `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean (/api/audit is a ƒ route).
- What's next / open issues:
  - Europe PMC often yields abstract-only for paywalled papers; a PDF-upload flow
    (paperSource:"pdf") is wired in the route but needs a PDF lib (pdfToText still
    throws until pdfjs-dist is added) and a UI file-picker.
  - Consider persisting/caching audits and generating the letter (report/letter.ts)
    from the live result behind a button.
