"use client";

/**
 * OutcomeLedger — one row per OutcomeMatch, color-coded by classification.
 *
 * Rows STREAM IN: rather than showing every match at once, the ledger reveals
 * them one-by-one on a timer to make the demo feel like a live audit. As each
 * row lands it is reported back via `onReveal` so the parent can recompute a
 * running integrity score.
 *
 * Accessibility: each row carries a text label + glyph badge, not just a color.
 */
import { useEffect, useMemo, useState } from "react";
import type { AuditResult, OutcomeMatch } from "@/lib/contract";
import { PRESENTATION } from "./outcomePresentation";

interface OutcomeLedgerProps {
  audit: AuditResult;
  /** ms between each revealed row. Default 220ms. */
  intervalMs?: number;
  /** Called with the match each time a row is revealed (for running score). */
  onReveal?: (match: OutcomeMatch, indexRevealed: number, total: number) => void;
  /** Called once all rows are revealed. */
  onComplete?: () => void;
}

/** Resolve the display measure text for a match from either side. */
function measureFor(audit: AuditResult, m: OutcomeMatch): string {
  if (m.reportedRef !== null) {
    const r = audit.reportedOutcomes[m.reportedRef];
    if (r) return r.measure;
  }
  if (m.registeredRef !== null) {
    const r = audit.trialRecord.registeredOutcomes[m.registeredRef];
    if (r) return r.measure;
  }
  return "(unknown outcome)";
}

/** The verbatim evidence quote, if the match points at a reported outcome. */
function quoteFor(audit: AuditResult, m: OutcomeMatch): { quote: string; section: string } | null {
  if (m.reportedRef !== null) {
    const r = audit.reportedOutcomes[m.reportedRef];
    if (r) return { quote: r.verbatimQuote, section: r.section };
  }
  return null;
}

/** Origin tag: where the outcome comes from (registry / paper). */
function originFor(m: OutcomeMatch): string {
  if (m.registeredRef !== null && m.reportedRef !== null) return "Registry ↔ Paper";
  if (m.registeredRef !== null) return "Registry only";
  return "Paper only";
}

function Row({
  audit,
  match,
}: {
  audit: AuditResult;
  match: OutcomeMatch;
}) {
  const [open, setOpen] = useState(false);
  const p = PRESENTATION[match.classification];
  const measure = measureFor(audit, match);
  const evidence = quoteFor(audit, match);
  const confidencePct = Math.round(match.confidence * 100);

  return (
    <li
      className={`border-l-4 ${p.rowClass} rounded-r-md animate-[fadeIn_0.35s_ease-out]`}
    >
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
        {/* badge */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${p.badgeClass}`}
          >
            <span aria-hidden>{p.glyph}</span>
            {p.label}
          </span>
        </div>

        {/* body */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {measure}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {originFor(match)} · confidence {confidencePct}%
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {match.rationale}
          </p>

          {evidence ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                aria-expanded={open}
              >
                {open ? "Hide evidence" : "Show verbatim evidence"}
              </button>
              {open ? (
                <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 text-xs italic text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  “{evidence.quote}”
                  <footer className="mt-1 not-italic text-[11px] text-zinc-400">
                    — {evidence.section}
                  </footer>
                </blockquote>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs italic text-zinc-400">
              No paper text — outcome absent from the publication.
            </p>
          )}
        </div>

        {/* confidence meter */}
        <div className="hidden w-24 shrink-0 sm:block">
          <div className="mb-1 text-right text-[11px] text-zinc-400">
            {confidencePct}%
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>
      </div>
    </li>
  );
}

export default function OutcomeLedger({
  audit,
  intervalMs = 220,
  onReveal,
  onComplete,
}: OutcomeLedgerProps) {
  // Order matches so the demo tells a story: green first, then reds, then the
  // demotions, then the amber additions.
  const ordered = useMemo(() => {
    const rank: Record<string, number> = {
      reported_as_prespecified: 0,
      silently_dropped: 1,
      demoted: 2,
      promoted: 2,
      timeframe_changed: 3,
      silently_added: 4,
    };
    return [...audit.matches].sort(
      (a, b) => rank[a.classification] - rank[b.classification],
    );
  }, [audit.matches]);

  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    if (ordered.length === 0) {
      onComplete?.();
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRevealed(i);
      onReveal?.(ordered[i - 1], i, ordered.length);
      if (i >= ordered.length) {
        clearInterval(id);
        onComplete?.();
      }
    }, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, intervalMs]);

  const streaming = revealed < ordered.length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Outcome ledger
        </h2>
        <span className="text-xs text-zinc-500" aria-live="polite">
          {streaming ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              Auditing… {revealed}/{ordered.length}
            </span>
          ) : (
            <>Reviewed {ordered.length} outcome matches</>
          )}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {ordered.slice(0, revealed).map((m, idx) => (
          <Row key={idx} audit={audit} match={m} />
        ))}
        {streaming ? (
          <li className="border-l-4 border-l-zinc-200 dark:border-l-zinc-800">
            <div className="animate-pulse px-4 py-3">
              <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-2 h-3 w-2/3 rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
