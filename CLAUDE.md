# CLAUDE.md — outcome-guard

Project conventions for Claude Code. Read this before making changes.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**.
- **Vercel AI SDK v6** (`ai`) with the **Anthropic provider** (`@ai-sdk/anthropic`).
- **zod** for schema validation.
- Data sources, fetched directly (no ORM, no local DB):
  - **ClinicalTrials.gov API v2** — https://clinicaltrials.gov/api/v2
  - **Europe PMC REST API** — https://www.ebi.ac.uk/europepmc/webservices/rest

## Conventions

- **Shared types live in `src/lib/contract/`** and are treated as **read-only by feature code**.
  Feature code imports from the contract; it does not modify it. Changes to the contract are
  deliberate, cross-cutting decisions — make them explicitly, not as a side effect of a feature.
- App Router: server code lives in route handlers (`src/app/**/route.ts`) and server components
  by default. Reach for `"use client"` only when a component needs browser APIs or interactivity.
- External APIs (ClinicalTrials.gov, Europe PMC) are fetched directly with `fetch`. Keep the
  fetching/parsing logic separate from the shared contract types it produces.

## RULE: Update BUILDLOG.md after every task

**After completing any task, append a dated entry to `BUILDLOG.md`.** Never skip this — it is
part of "done" for every task. Use the entry format defined at the top of `BUILDLOG.md`.
