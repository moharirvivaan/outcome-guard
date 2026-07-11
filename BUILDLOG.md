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
