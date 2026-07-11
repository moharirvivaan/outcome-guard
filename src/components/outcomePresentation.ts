/**
 * Presentation layer for OutcomeClassification: maps each classification to a
 * severity bucket (green / red / amber / warning) plus the labels, icons and
 * Tailwind classes used across the demo UI. Kept separate so OutcomeLedger and
 * ScoreGauge agree on semantics.
 *
 * Accessibility: every bucket carries a text label and a glyph, so meaning is
 * never conveyed by color alone.
 */
import type { OutcomeClassification, OutcomeMatch } from "@/lib/contract";

export type Severity = "green" | "red" | "amber" | "warning";

/**
 * Presentation grouping of the six classifications into the three buckets the
 * summary UI (verdict banner, distribution bar, filter chips) speaks in. This
 * mirrors the scorer's fold (src/lib/report/score.ts) — demoted counts with the
 * drops, promoted/timeframe_changed with the additions — but is a pure UI-side
 * derivation over matches already in component state; it computes nothing new.
 */
export type OutcomeGroup = "faithful" | "dropped" | "added";

export function groupFor(classification: OutcomeClassification): OutcomeGroup {
  switch (classification) {
    case "reported_as_prespecified":
      return "faithful";
    case "silently_dropped":
    case "demoted":
      return "dropped";
    case "silently_added":
    case "promoted":
    case "timeframe_changed":
      return "added";
  }
}

export interface GroupCounts {
  faithful: number;
  dropped: number;
  added: number;
  total: number;
}

/** Count matches into the three summary buckets. Pure, no side effects. */
export function countGroups(matches: OutcomeMatch[]): GroupCounts {
  const counts: GroupCounts = { faithful: 0, dropped: 0, added: 0, total: 0 };
  for (const m of matches) {
    counts[groupFor(m.classification)]++;
    counts.total++;
  }
  return counts;
}

export interface ClassPresentation {
  severity: Severity;
  /** Short human label shown on the row. */
  label: string;
  /** Non-color glyph so the state reads without color. */
  glyph: string;
  /** One-line description of what this classification means. */
  blurb: string;
  /** Tailwind classes for the row's left border + subtle background tint. */
  rowClass: string;
  /** Tailwind classes for the pill/badge. */
  badgeClass: string;
  /** Penalty applied to the running integrity score when this row lands. */
  penalty: number;
}

/*
 * Row + badge classes use the semantic status tokens from globals.css
 * (--color-ok / --color-danger / --color-warn / --color-caution and their
 * -tint / -fg pairs), which are defined for BOTH light and dark mode and were
 * chosen so each foreground meets WCAG AA (>=4.5:1) on its own tinted surface.
 * One place to change status semantics; ledger + gauge read from here.
 */
export const PRESENTATION: Record<OutcomeClassification, ClassPresentation> = {
  reported_as_prespecified: {
    severity: "green",
    label: "Faithfully reported",
    glyph: "✓",
    blurb: "Prespecified outcome reported as registered.",
    rowClass: "border-l-ok bg-ok-tint",
    badgeClass: "bg-ok-tint text-ok-fg ring-1 ring-ok/40",
    penalty: 0,
  },
  silently_dropped: {
    severity: "red",
    label: "Silently dropped",
    glyph: "✕",
    blurb: "Prespecified outcome missing from the paper.",
    rowClass: "border-l-danger bg-danger-tint",
    badgeClass: "bg-danger-tint text-danger-fg ring-1 ring-danger/40",
    penalty: 8,
  },
  silently_added: {
    severity: "amber",
    label: "Silently added",
    glyph: "+",
    blurb: "Reported outcome that was never prespecified.",
    rowClass: "border-l-warn bg-warn-tint",
    badgeClass: "bg-warn-tint text-warn-fg ring-1 ring-warn/40",
    penalty: 4,
  },
  promoted: {
    severity: "amber",
    label: "Promoted",
    glyph: "▲",
    blurb: "A prespecified secondary reported as primary.",
    rowClass: "border-l-warn bg-warn-tint",
    badgeClass: "bg-warn-tint text-warn-fg ring-1 ring-warn/40",
    penalty: 3,
  },
  demoted: {
    severity: "warning",
    label: "Demoted",
    glyph: "▼",
    blurb: "A prespecified outcome reframed as merely exploratory.",
    rowClass: "border-l-caution bg-caution-tint",
    badgeClass: "bg-caution-tint text-caution-fg ring-1 ring-caution/40",
    penalty: 5,
  },
  timeframe_changed: {
    severity: "amber",
    label: "Time frame changed",
    glyph: "⏱",
    blurb: "Reported at a different time frame than registered.",
    rowClass: "border-l-warn bg-warn-tint",
    badgeClass: "bg-warn-tint text-warn-fg ring-1 ring-warn/40",
    penalty: 3,
  },
};

/**
 * Colors for the score gauge arc keyed by score band. The `hex` values read the
 * live CSS custom properties so the arc tracks light/dark automatically; the
 * text class uses the same semantic tokens.
 */
export function scoreColor(score: number): {
  cssVar: string;
  label: string;
  textClass: string;
} {
  if (score >= 75)
    return { cssVar: "var(--ok)", label: "High integrity", textClass: "text-ok-fg" };
  if (score >= 50)
    return { cssVar: "var(--warn)", label: "Moderate concerns", textClass: "text-warn-fg" };
  return {
    cssVar: "var(--danger)",
    label: "Serious outcome switching",
    textClass: "text-danger-fg",
  };
}
