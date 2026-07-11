"use client";

/**
 * Presentation-only summary widgets for the results view: a verdict banner, a
 * summary distribution bar, and filter chips.
 *
 * Everything here is DERIVED from data the UI already holds — the matches array
 * (via countGroups) and the registered-outcome count. No new data, no backend,
 * no changes to timing/scoring. All three reuse the existing status tokens so
 * they read as one system with the ledger rows.
 */
import type { GroupCounts } from "./outcomePresentation";
import type { LedgerFilter } from "./OutcomeLedger";

/* --- shared inline SVG icons (no emoji as structural icons) --- */
function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * VERDICT BANNER — one plain-English sentence stating the finding. Accent color
 * tracks severity: red when anything was dropped or the score is failing, amber
 * for milder issues, green only when the trial reported everything faithfully.
 */
export function VerdictBanner({
  counts,
  registeredCount,
  score,
}: {
  counts: GroupCounts;
  registeredCount: number;
  score: number;
}) {
  const clean = counts.dropped === 0 && counts.added === 0;
  const severe = counts.dropped > 0 || score < 40;

  const tone = clean ? "ok" : severe ? "danger" : "warn";
  const toneClass =
    tone === "ok"
      ? "border-[color:var(--ok)]/30 bg-ok-tint text-ok-fg"
      : tone === "danger"
        ? "border-[color:var(--danger)]/30 bg-danger-tint text-danger-fg"
        : "border-[color:var(--warn)]/30 bg-warn-tint text-warn-fg";

  return (
    <div
      className={`mt-6 flex items-start gap-3 rounded-xl border p-4 sm:p-5 ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      <span className="mt-0.5 shrink-0" aria-hidden>
        {clean ? <CheckIcon /> : <AlertIcon />}
      </span>
      <p className="text-base font-semibold leading-snug sm:text-lg">
        {clean ? (
          <>
            This trial reported all{" "}
            <span className="tabular-nums">{registeredCount}</span> pre-specified
            outcomes as promised — none dropped, none added.
          </>
        ) : (
          <>
            This trial reported{" "}
            <span className="tabular-nums">{counts.faithful}</span> of{" "}
            <span className="tabular-nums">{registeredCount}</span> pre-specified
            outcomes as promised — dropped{" "}
            <span className="tabular-nums">{counts.dropped}</span>, and added{" "}
            <span className="tabular-nums">{counts.added}</span> it never registered.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * SUMMARY DISTRIBUTION BAR — a single stacked bar segmented
 * green(faithful)/red(dropped)/amber(added), widths proportional to the counts,
 * with a count label beside each present segment (so meaning is never color-only).
 */
export function DistributionBar({ counts }: { counts: GroupCounts }) {
  const total = counts.total || 1; // avoid /0; an empty bar renders as track only
  const segments = [
    { key: "faithful", n: counts.faithful, bar: "bg-ok", label: "Faithful", fg: "text-ok-fg" },
    { key: "dropped", n: counts.dropped, bar: "bg-danger", label: "Dropped", fg: "text-danger-fg" },
    { key: "added", n: counts.added, bar: "bg-warn", label: "Added", fg: "text-warn-fg" },
  ] as const;

  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={`Outcome distribution: ${counts.faithful} faithful, ${counts.dropped} dropped, ${counts.added} added.`}
      >
        {segments.map((s) =>
          s.n > 0 ? (
            <div
              key={s.key}
              className={`${s.bar} h-full`}
              style={{ width: `${(s.n / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.bar}`} aria-hidden />
            <span className="text-muted-foreground">{s.label}</span>
            <span className={`font-mono font-semibold tabular-nums ${s.fg}`}>{s.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * FILTER CHIPS — a view filter over the already-loaded ledger rows. Selecting a
 * chip narrows the visible rows; "All" resets. Active chip is marked by fill +
 * ring (not color alone). Purely client-side; changes no data.
 */
export function FilterChips({
  counts,
  active,
  onChange,
}: {
  counts: GroupCounts;
  active: LedgerFilter;
  onChange: (f: LedgerFilter) => void;
}) {
  const chips: { key: LedgerFilter; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.total },
    { key: "faithful", label: "Faithful", n: counts.faithful },
    { key: "dropped", label: "Dropped", n: counts.dropped },
    { key: "added", label: "Added", n: counts.added },
  ];

  return (
    <div
      className="mb-3 flex flex-wrap gap-2"
      role="group"
      aria-label="Filter outcomes by category"
    >
      {chips.map((c) => {
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            aria-pressed={isActive}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
              isActive
                ? "border-primary bg-primary text-on-primary"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            {c.label}
            <span
              className={`rounded-full px-1.5 py-0.5 font-mono tabular-nums ${
                isActive ? "bg-on-primary/20" : "bg-surface-muted"
              }`}
            >
              {c.n}
            </span>
          </button>
        );
      })}
    </div>
  );
}
