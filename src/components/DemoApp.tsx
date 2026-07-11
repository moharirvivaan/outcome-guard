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
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Header />

      {/* Controls */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="nct" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Paste an NCT ID
            </label>
            <input
              id="nct"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={nctInput}
              onChange={(e) => setNctInput(e.target.value)}
              placeholder="e.g. NCT01951625"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={liveStreaming}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Audit
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={handleLoadDemo}
            disabled={liveStreaming}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PlayIcon />
            Audit demo trial: Vericiguat / SOCRATES-REDUCED
          </button>
          <span className="font-mono text-xs text-muted-foreground">
            NCT01951625 · JAMA 2015
          </span>

          <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={offline}
              onChange={(e) => setOffline(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[color:var(--primary)] focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            Offline demo (no key / network)
          </label>
        </div>

        {/* Reviewer-aid disclaimer, always visible. */}
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <InfoIcon />
          <span>
            Each classification is a <strong className="font-semibold text-foreground">reviewer aid, not a verdict</strong> —
            every flag carries a confidence and a verbatim quote you can check against the source.
          </span>
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
        <div
          className="mt-6 flex items-center gap-2 rounded-lg border border-[color:var(--info)]/30 bg-info-tint px-4 py-3 text-sm text-info"
          role="status"
          aria-live="polite"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-info" />
          <span className="font-medium">{state.phase || "Auditing…"}</span>
          {state.paperMeta ? (
            <span className="ml-1 truncate font-mono text-xs opacity-70">· {state.paperMeta}</span>
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

      {state.status === "idle" && !offlineOn && !localError ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Audit the demo trial, or paste any NCT id, to run a live audit.
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
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <ShieldIcon />
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          outcome-guard
        </h1>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Detect outcome switching in clinical trials: compare what a trial
        <em className="text-foreground"> prespecified</em> in its registry against what its results
        paper <em className="text-foreground">actually reported</em> — surfacing silently dropped,
        added, and demoted outcomes, every claim backed by a verbatim quote.
      </p>
    </header>
  );
}

/* --- Inline SVG icons (no emoji as structural icons) --- */
function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="mt-0.5 shrink-0 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      className="mt-6 rounded-xl border border-[color:var(--danger)]/30 bg-danger-tint p-5 text-sm text-danger-fg"
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Audit could not complete</p>
          <p className="mt-1">{message}</p>
          <p className="mt-2 text-xs opacity-80">
            Try the demo trial, another NCT with an open-access results paper, or the
            offline demo.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex min-h-9 shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-[color:var(--danger)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--danger)]/40"
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
    <div
      className="rounded-xl border border-[color:var(--info)]/25 bg-info-tint p-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Spinner />
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      {/* Placeholder rows to signal that ledger content is imminent. */}
      <ul className="mt-4 flex flex-col gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="animate-pulse rounded-r-lg border-l-4 border-l-[color:var(--info)]/30 bg-surface/60 px-4 py-3"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <div className="h-3 w-1/3 rounded bg-[color:var(--info)]/15" />
            <div className="mt-2 h-3 w-2/3 rounded bg-[color:var(--info)]/10" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[color:var(--info)]/25 border-t-info"
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
  const live = badge === "live";
  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8">
      {/* On mobile the score card comes first so the headline number leads;
          on desktop the ledger takes the main column and the card sits right. */}
      <aside className="order-1 lg:order-2">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-6">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{nctId}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                live
                  ? "bg-info-tint text-info"
                  : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {live ? <span className="h-1.5 w-1.5 rounded-full bg-info" /> : null}
              {badge}
            </span>
          </div>
          <div className="mb-4 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {title}
          </div>
          <ScoreGauge score={score} caption={caption} />
          <dl className="mt-5 space-y-2 border-t border-border pt-4 text-xs">
            <Stat label="Registered outcomes" value={registered} />
            <Stat label="Reported outcomes" value={reported} />
            <Stat label="Matches judged" value={matchesJudged} />
          </dl>
        </div>
      </aside>
      <div className="order-2 lg:order-1">{ledger}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
