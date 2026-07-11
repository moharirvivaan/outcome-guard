"use client";

/**
 * DemoApp — the interactive demo surface for outcome-guard.
 *
 * - NCT-id paste input (controlled) + submit button. There is no backend here,
 *   so submitting a *known demo* id runs the local mock; anything else shows a
 *   "coming soon" state rather than fabricating a fake API response.
 * - A prominent "Load demo trial" button wires straight to the local mock.
 * - Once an audit is loaded, OutcomeLedger streams rows in and ScoreGauge shows
 *   a running integrity score that settles on the mock's integrityScore.
 */
import { useCallback, useMemo, useState } from "react";
import type { AuditResult, OutcomeMatch } from "@/lib/contract";
import { mockAudit } from "./mockAudit";
import OutcomeLedger from "./OutcomeLedger";
import ScoreGauge from "./ScoreGauge";
import { PRESENTATION } from "./outcomePresentation";

const DEMO_NCT = "NCT01951625";

type View =
  | { kind: "idle" }
  | { kind: "coming_soon"; nctId: string }
  | { kind: "loaded"; audit: AuditResult };

export default function DemoApp() {
  const [nctInput, setNctInput] = useState("");
  const [view, setView] = useState<View>({ kind: "idle" });

  // Running score: starts at 100 and drops by each landed row's penalty, then
  // is snapped to the audit's authoritative integrityScore on completion.
  const [runningScore, setRunningScore] = useState(100);
  const [issueCount, setIssueCount] = useState(0);

  const loadDemo = useCallback(() => {
    setRunningScore(100);
    setIssueCount(0);
    setView({ kind: "loaded", audit: mockAudit });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const id = nctInput.trim().toUpperCase();
      if (id === DEMO_NCT) {
        loadDemo();
        return;
      }
      if (/^NCT\d{8}$/.test(id)) {
        setView({ kind: "coming_soon", nctId: id });
        return;
      }
      setView({ kind: "coming_soon", nctId: id || "(empty)" });
    },
    [nctInput, loadDemo],
  );

  const handleReveal = useCallback(
    (match: OutcomeMatch) => {
      const penalty = PRESENTATION[match.classification].penalty;
      if (penalty > 0) {
        setRunningScore((s) => Math.max(0, s - penalty));
        setIssueCount((c) => c + 1);
      }
    },
    [],
  );

  const handleComplete = useCallback(() => {
    if (view.kind === "loaded") {
      setRunningScore(view.audit.integrityScore);
    }
  }, [view]);

  const audit = view.kind === "loaded" ? view.audit : null;

  const caption = useMemo(() => {
    if (!audit) return undefined;
    return `${issueCount} issue${issueCount === 1 ? "" : "s"} flagged`;
  }, [audit, issueCount]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            🛡️
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            outcome-guard
          </h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Detect outcome switching in clinical trials: compare what a trial
          <em> prespecified</em> in its registry against what its results paper
          <em> actually reported</em> — surfacing silently dropped, added, and
          demoted outcomes, every claim backed by a verbatim quote.
        </p>
      </header>

      {/* Controls */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label
              htmlFor="nct"
              className="mb-1 block text-xs font-medium text-zinc-500"
            >
              Paste an NCT ID
            </label>
            <input
              id="nct"
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              value={nctInput}
              onChange={(e) => setNctInput(e.target.value)}
              placeholder="e.g. NCT01951625"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Audit
            </button>
          </div>
        </form>

        <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={loadDemo}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <span aria-hidden>▶</span>
            Load demo trial (NCT01951625)
          </button>
          <span className="text-xs text-zinc-500">
            SOCRATES-REDUCED · Vericiguat · JAMA 2015
          </span>
        </div>
      </section>

      {/* Coming soon state */}
      {view.kind === "coming_soon" ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Live auditing is coming soon.</p>
          <p className="mt-1">
            Auditing <span className="font-mono">{view.nctId}</span> against the
            live ClinicalTrials.gov registry and its results paper is not wired
            up in this demo. Try the built-in demo trial to see a full audit.
          </p>
        </div>
      ) : null}

      {/* Results */}
      {audit ? (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="lg:order-1">
            <OutcomeLedger
              audit={audit}
              intervalMs={220}
              onReveal={handleReveal}
              onComplete={handleComplete}
            />
          </div>

          <aside className="lg:order-2">
            <div className="sticky top-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {audit.trialRecord.nctId}
              </div>
              <div className="mb-4 line-clamp-3 text-xs text-zinc-500">
                {audit.trialRecord.title}
              </div>
              <ScoreGauge score={runningScore} caption={caption} />
              <dl className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Registered outcomes</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {audit.trialRecord.registeredOutcomes.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Reported outcomes</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {audit.reportedOutcomes.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Matches judged</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {audit.matches.length}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      ) : null}

      {view.kind === "idle" ? (
        <p className="mt-10 text-center text-sm text-zinc-400">
          Load the demo trial to watch the audit stream in.
        </p>
      ) : null}
    </div>
  );
}
