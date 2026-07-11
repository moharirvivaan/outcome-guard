"use client";

/**
 * DemoApp — the interactive surface for outcome-guard.
 *
 * Two paths:
 *  - LIVE (default): "Load demo trial" and the "Audit" button hit POST
 *    /api/audit and stream the audit in — registry, paper, extraction, then one
 *    ledger row per resolved match, then the score. The demo trial (NCT01951625)
 *    uses the paper fixture server-side; any other NCT id goes via Europe PMC.
 *  - OFFLINE DEMO (toggle): renders the committed `mockAudit` with the original
 *    timer-based streaming, so the UI works with no API key / no network.
 *
 * The Anthropic key lives only on the server; the client never sees it.
 */
import { useCallback, useMemo, useState } from "react";
import type { OutcomeMatch } from "@/lib/contract";
import { mockAudit } from "./mockAudit";
import OutcomeLedger from "./OutcomeLedger";
import ScoreGauge from "./ScoreGauge";
import { PRESENTATION } from "./outcomePresentation";
import { useAuditStream } from "./useAuditStream";

const DEMO_NCT = "NCT01951625";

export default function DemoApp() {
  const [nctInput, setNctInput] = useState("");
  const [offline, setOffline] = useState(false);

  const { state, start, reset } = useAuditStream();

  // A local, client-side error (bad input / offline+non-demo) that doesn't need
  // a server round-trip. Rendered through the same banner as stream errors.
  const [localError, setLocalError] = useState<string | null>(null);

  // ---- Offline (mock) mode state -------------------------------------------
  const [offlineOn, setOfflineOn] = useState(false);
  const [offlineScore, setOfflineScore] = useState(100);
  const [offlineIssues, setOfflineIssues] = useState(0);

  const runOffline = useCallback(() => {
    reset();
    setOfflineScore(100);
    setOfflineIssues(0);
    setOfflineOn(true);
  }, [reset]);

  const runLive = useCallback(
    (nctId: string) => {
      setLocalError(null);
      setOfflineOn(false);
      void start({ nctId });
    },
    [start],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const id = nctInput.trim().toUpperCase();
      if (!/^NCT\d{8}$/.test(id)) {
        reset();
        setOfflineOn(false);
        setLocalError(`"${nctInput.trim() || "(empty)"}" is not a valid NCT id (expected NCT + 8 digits).`);
        return;
      }
      if (offline) {
        reset();
        if (id === DEMO_NCT) runOffline();
        else
          setLocalError(
            `The offline demo only covers the demo trial ${DEMO_NCT}. Uncheck "Offline demo" to audit ${id} live.`,
          );
        return;
      }
      runLive(id);
    },
    [nctInput, offline, reset, runOffline, runLive],
  );

  const handleLoadDemo = useCallback(() => {
    setLocalError(null);
    if (offline) runOffline();
    else runLive(DEMO_NCT);
  }, [offline, runOffline, runLive]);

  const handleOfflineReveal = useCallback((match: OutcomeMatch) => {
    const penalty = PRESENTATION[match.classification].penalty;
    if (penalty > 0) {
      setOfflineScore((s) => Math.max(0, s - penalty));
      setOfflineIssues((c) => c + 1);
    }
  }, []);

  const handleOfflineComplete = useCallback(() => {
    setOfflineScore(mockAudit.integrityScore);
  }, []);

  // ---- Derived view for the live path --------------------------------------
  const liveActive =
    !offlineOn && state.status !== "idle" && state.status !== "error";
  const liveStreaming = liveActive && state.status !== "done";

  const liveCaption = useMemo(() => {
    if (offlineOn) return undefined;
    const issues = state.matches.filter(
      (m) => PRESENTATION[m.classification].penalty > 0,
    ).length;
    return state.status === "done"
      ? `${issues} issue${issues === 1 ? "" : "s"} flagged`
      : state.phase;
  }, [offlineOn, state.matches, state.status, state.phase]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <Header />

      {/* Controls */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="nct" className="mb-1 block text-xs font-medium text-zinc-500">
              Paste an NCT ID
            </label>
            <input
              id="nct"
              type="text"
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
              disabled={liveStreaming}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Audit
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleLoadDemo}
            disabled={liveStreaming}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden>▶</span>
            Audit demo trial: Vericiguat / SOCRATES-REDUCED
          </button>
          <span className="text-xs text-zinc-500">
            NCT01951625 · JAMA 2015
          </span>

          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={offline}
              onChange={(e) => setOffline(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600"
            />
            Offline demo (no API key / network)
          </label>
        </div>

        {/* Reviewer-aid disclaimer, always visible. */}
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          Each classification is a <strong>reviewer aid, not a verdict</strong> — every
          flag carries a confidence and a verbatim quote you can check against the source.
        </p>
      </section>

      {/* Error banners: local validation first, then stream errors. */}
      {localError ? (
        <ErrorBanner message={localError} onDismiss={() => setLocalError(null)} />
      ) : !offlineOn && state.status === "error" ? (
        <ErrorBanner
          message={state.errorMessage ?? "Something went wrong."}
          onDismiss={reset}
        />
      ) : null}

      {!offlineOn && liveStreaming ? (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          {state.phase || "Auditing…"}
          {state.paperMeta ? (
            <span className="ml-2 truncate text-xs text-blue-500/80">· {state.paperMeta}</span>
          ) : null}
        </div>
      ) : null}

      {/* OFFLINE (mock) results */}
      {offlineOn ? (
        <ResultsLayout
          nctId={mockAudit.trialRecord.nctId}
          title={mockAudit.trialRecord.title}
          score={offlineScore}
          caption={`${offlineIssues} issue${offlineIssues === 1 ? "" : "s"} flagged`}
          registered={mockAudit.trialRecord.registeredOutcomes.length}
          reported={mockAudit.reportedOutcomes.length}
          matchesJudged={mockAudit.matches.length}
          badge="offline demo"
          ledger={
            <OutcomeLedger
              audit={mockAudit}
              intervalMs={220}
              onReveal={handleOfflineReveal}
              onComplete={handleOfflineComplete}
            />
          }
        />
      ) : null}

      {/* LIVE results (renders as soon as the registry lands) */}
      {!offlineOn && liveActive && state.trial ? (
        <ResultsLayout
          nctId={state.trial.nctId}
          title={state.trial.title}
          score={state.runningScore}
          caption={liveCaption}
          registered={state.trial.registeredOutcomes.length}
          reported={state.reportedOutcomes.length}
          matchesJudged={state.matches.length}
          badge="live"
          ledger={
            state.matches.length > 0 || state.status === "done" ? (
              <OutcomeLedger
                audit={liveAuditShim(state)}
                streamed
                matches={state.matches}
                streaming={state.status !== "done"}
              />
            ) : (
              <WorkingState
                status={state.status}
                registeredCount={state.trial.registeredOutcomes.length}
                reportedCount={state.reportedOutcomes.length}
              />
            )
          }
        />
      ) : null}

      {state.status === "idle" && !offlineOn ? (
        <p className="mt-10 text-center text-sm text-zinc-400">
          Load the demo trial, or paste any NCT id, to run a live audit.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The OutcomeLedger's Row helpers read measure/quote from an AuditResult, so in
 * live streamed mode we hand it a lightweight shim carrying the trial +
 * reported outcomes received so far. Only the fields Row reads are populated.
 */
function liveAuditShim(state: ReturnType<typeof useAuditStream>["state"]) {
  return {
    trialRecord: state.trial ?? {
      nctId: "",
      title: "",
      status: "",
      registeredOutcomes: [],
      resultPublicationRefs: [],
    },
    reportedOutcomes: state.reportedOutcomes,
    matches: state.matches,
    integrityScore: state.score,
    metadata: { registrySource: "", paperSource: "" },
  };
}

function Header() {
  return (
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
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Audit could not complete</p>
          <p className="mt-1">{message}</p>
          <p className="mt-2 text-xs text-red-700/80 dark:text-red-300/70">
            Try the demo trial, another NCT with an open-access results paper, or the
            offline demo.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-500/20"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/**
 * Active working state shown in the ledger slot during the extract/match beats,
 * so the several seconds each LLM call takes read as visible work, not a freeze.
 */
function WorkingState({
  status,
  registeredCount,
  reportedCount,
}: {
  status: string;
  registeredCount: number;
  reportedCount: number;
}) {
  const label =
    status === "extracting"
      ? "Reading the paper's Methods & Results…"
      : status === "matching"
        ? `Opus is comparing ${registeredCount} registered vs ${reportedCount} reported outcomes…`
        : status === "reported"
          ? "Preparing the comparison…"
          : "Fetching the registry & results paper…";

  const sub =
    status === "extracting"
      ? "Extracting every reported outcome with a verbatim quote (Sonnet)."
      : status === "matching"
        ? "Aligning each registered outcome to what the paper reported and classifying switches."
        : "This can take a few seconds.";

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-6 dark:border-blue-500/30 dark:bg-blue-500/10">
      <div className="flex items-center gap-3">
        <Spinner />
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">{label}</p>
          <p className="mt-0.5 text-xs text-blue-700/80 dark:text-blue-300/70">{sub}</p>
        </div>
      </div>
      {/* Placeholder rows to signal that ledger content is imminent. */}
      <ul className="mt-4 flex flex-col gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="animate-pulse rounded-md border-l-4 border-l-blue-200 bg-white/60 px-4 py-3 dark:border-l-blue-500/30 dark:bg-zinc-900/40"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <div className="h-3 w-1/3 rounded bg-blue-100 dark:bg-blue-500/20" />
            <div className="mt-2 h-3 w-2/3 rounded bg-blue-50 dark:bg-blue-500/10" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600 dark:border-blue-500/30 dark:border-t-blue-400"
      role="status"
      aria-label="Working"
    />
  );
}

interface ResultsLayoutProps {
  nctId: string;
  title: string;
  score: number;
  caption?: string;
  registered: number;
  reported: number;
  matchesJudged: number;
  badge: string;
  ledger: React.ReactNode;
}

function ResultsLayout({
  nctId,
  title,
  score,
  caption,
  registered,
  reported,
  matchesJudged,
  badge,
  ledger,
}: ResultsLayoutProps) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="lg:order-1">{ledger}</div>
      <aside className="lg:order-2">
        <div className="sticky top-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {nctId}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
              {badge}
            </span>
          </div>
          <div className="mb-4 line-clamp-3 text-xs text-zinc-500">{title}</div>
          <ScoreGauge score={score} caption={caption} />
          <dl className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
            <Stat label="Registered outcomes" value={registered} />
            <Stat label="Reported outcomes" value={reported} />
            <Stat label="Matches judged" value={matchesJudged} />
          </dl>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
