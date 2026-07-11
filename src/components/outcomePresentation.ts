/**
 * Presentation layer for OutcomeClassification: maps each classification to a
 * severity bucket (green / red / amber / warning) plus the labels, icons and
 * Tailwind classes used across the demo UI. Kept separate so OutcomeLedger and
 * ScoreGauge agree on semantics.
 *
 * Accessibility: every bucket carries a text label and a glyph, so meaning is
 * never conveyed by color alone.
 */
import type { OutcomeClassification } from "@/lib/contract";

export type Severity = "green" | "red" | "amber" | "warning";

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

export const PRESENTATION: Record<OutcomeClassification, ClassPresentation> = {
  reported_as_prespecified: {
    severity: "green",
    label: "Faithfully reported",
    glyph: "✓",
    blurb: "Prespecified outcome reported as registered.",
    rowClass:
      "border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10",
    badgeClass:
      "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    penalty: 0,
  },
  silently_dropped: {
    severity: "red",
    label: "Silently dropped",
    glyph: "✕",
    blurb: "Prespecified outcome missing from the paper.",
    rowClass: "border-l-red-500 bg-red-50/60 dark:bg-red-500/10",
    badgeClass:
      "bg-red-100 text-red-800 ring-1 ring-red-600/30 dark:bg-red-500/15 dark:text-red-300",
    penalty: 8,
  },
  silently_added: {
    severity: "amber",
    label: "Silently added",
    glyph: "+",
    blurb: "Reported outcome that was never prespecified.",
    rowClass: "border-l-amber-500 bg-amber-50/60 dark:bg-amber-500/10",
    badgeClass:
      "bg-amber-100 text-amber-900 ring-1 ring-amber-600/30 dark:bg-amber-500/15 dark:text-amber-300",
    penalty: 4,
  },
  promoted: {
    severity: "amber",
    label: "Promoted",
    glyph: "▲",
    blurb: "A prespecified secondary reported as primary.",
    rowClass: "border-l-amber-500 bg-amber-50/60 dark:bg-amber-500/10",
    badgeClass:
      "bg-amber-100 text-amber-900 ring-1 ring-amber-600/30 dark:bg-amber-500/15 dark:text-amber-300",
    penalty: 3,
  },
  demoted: {
    severity: "warning",
    label: "Demoted",
    glyph: "▼",
    blurb: "A prespecified outcome reframed as merely exploratory.",
    rowClass: "border-l-orange-500 bg-orange-50/60 dark:bg-orange-500/10",
    badgeClass:
      "bg-orange-100 text-orange-900 ring-1 ring-orange-600/30 dark:bg-orange-500/15 dark:text-orange-300",
    penalty: 5,
  },
  timeframe_changed: {
    severity: "amber",
    label: "Time frame changed",
    glyph: "⏱",
    blurb: "Reported at a different time frame than registered.",
    rowClass: "border-l-amber-500 bg-amber-50/60 dark:bg-amber-500/10",
    badgeClass:
      "bg-amber-100 text-amber-900 ring-1 ring-amber-600/30 dark:bg-amber-500/15 dark:text-amber-300",
    penalty: 3,
  },
};

/** Colors for the score gauge arc keyed by score band. */
export function scoreColor(score: number): {
  hex: string;
  label: string;
  textClass: string;
} {
  if (score >= 75)
    return { hex: "#10b981", label: "High integrity", textClass: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 50)
    return { hex: "#f59e0b", label: "Moderate concerns", textClass: "text-amber-600 dark:text-amber-400" };
  return { hex: "#ef4444", label: "Serious outcome switching", textClass: "text-red-600 dark:text-red-400" };
}
