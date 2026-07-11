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
