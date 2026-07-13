# outcome-guard

**Detect outcome switching in clinical trials.** outcome-guard compares what a trial
*pre-specified* in its public registry against what its results paper *actually reported* —
surfacing outcomes that were **silently dropped**, **silently added**, or quietly
**demoted** to "exploratory." Every finding is backed by a verbatim quote from the paper,
so it's auditable rather than a black box.

> Built for *Built with Claude: Life Sciences*.

## Why

When a trial reports outcomes it never registered, or drops the ones it promised, the
published result can look more positive than the trial actually was. This is
**outcome switching** — a well-documented integrity problem (see the
[COMPare project](https://www.compare-trials.org/)). outcome-guard automates the
registry-vs-paper comparison that catching it normally requires by hand.

## How it works

For a given trial (an NCT ID), the pipeline runs:

1. **Registry** — fetch the trial's pre-specified outcomes from the
   [ClinicalTrials.gov API v2](https://clinicaltrials.gov/api/v2).
2. **Paper** — resolve the results-publication text (via
   [Europe PMC](https://www.ebi.ac.uk/europepmc); the demo trial uses a bundled fixture
   since its paper is paywalled).
3. **Extract** — an LLM pulls every outcome the paper *reports*, each with a verbatim quote
   (Claude Sonnet).
4. **Match** — an LLM aligns registered vs. reported outcomes and classifies each
   relationship — faithfully reported, silently dropped, silently added, promoted, demoted,
   or timeframe-changed — with a confidence and rationale (Claude Opus). This handles the
   hard cases: renamed/reworded outcomes, composite/split outcomes, and timeframe changes.
5. **Score** — a saturating penalty model turns the matches into a 0–100 **integrity score**
   (a dropped *primary* outcome hurts most).

Results stream into the UI live: the registry lands, the paper resolves, then ledger rows
appear one by one, the integrity gauge ticks down as damning findings arrive, and a plain-
English verdict banner summarizes the finding. A COMPare-style letter-to-the-editor can be
generated from the result.

> **outcome-guard is a reviewer aid, not a verdict.** Every classification carries a
> confidence and a verbatim quote to check against the source.

## Demo trial

The bundled demo is **NCT01951625** — the Vericiguat *SOCRATES-REDUCED* trial (JAMA, 2015),
a known outcome-switching case. Its paper is paywalled, so the paper text ships as a fixture
(`fixtures/paper.NCT01951625.json`) and the demo never hits the network for it. There's also
an **offline demo** toggle that renders a committed mock result with no API key or network —
handy when connectivity is unreliable.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **Vercel AI SDK v6** (`ai`) with the **Anthropic provider** (`@ai-sdk/anthropic`) — Claude
  Sonnet for extraction, Claude Opus for matching
- **Zod** for the shared data contract
- Data from **ClinicalTrials.gov API v2** and **Europe PMC**, fetched directly (no DB)

## Getting started

```bash
npm install

# Live auditing calls the Anthropic API — set your key (server-side only):
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

npm run dev        # http://localhost:3000
```

Open the app, then **Audit demo trial: Vericiguat / SOCRATES-REDUCED**, or paste any NCT ID.
No key? Tick **Offline demo** to see a full result from the bundled mock.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (`ANTHROPIC_API_KEY` must be in the process env) |
| `npm run lint` | ESLint |

## Project layout

```
src/
  app/
    api/audit/route.ts   # POST /api/audit — streams the audit as newline-delimited JSON
    page.tsx             # renders the demo UI
  lib/
    contract/            # shared Zod schemas + types (read-only to feature code)
    ingest/              # ClinicalTrials.gov v2, Europe PMC, PDF fallback
    engine/              # extractReported (Sonnet) + matchOutcomes (Opus)
    report/              # integrity score + letter-to-the-editor
  components/            # DemoApp, OutcomeLedger, ScoreGauge, results summary widgets
fixtures/                # demo-trial registry + paper fixtures
DEMO_TRIALS.md           # demo/backup trials + ground-truth oracle
BUILDLOG.md              # dated log of what was built
```

See `CLAUDE.md` for project conventions.
