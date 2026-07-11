/**
 * COMPare-style letter-to-the-editor generation for an outcome-switching audit.
 *
 * `generateLetter` always works: when an ANTHROPIC_API_KEY is present it uses
 * the Vercel AI SDK (Claude) for prose quality; otherwise it falls back to a
 * fully deterministic, template-assembled letter built purely from the audit's
 * matches and score. The fallback is written to be demo-quality on its own.
 *
 * COMPare (Goldacre et al., compare-trials.org) monitored published trials for
 * discrepancies between prespecified and reported outcomes and wrote letters to
 * the journals. This module reproduces that house style: polite, specific,
 * evidence-cited, and firm in requesting a correction.
 */

import type { AuditResult, OutcomeMatch, ReportedOutcome, RegisteredOutcome } from "@/lib/contract";
import { scoreBreakdown } from "./score";

export interface GenerateLetterOptions {
  /** Model id for the AI-SDK path. Defaults to "claude-opus-4-8". */
  model?: string;
}

const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Generate a letter-to-the-editor for the audited trial.
 *
 * Offline (no ANTHROPIC_API_KEY) this returns the deterministic template
 * letter. With a key set it asks Claude to write the letter, seeded with the
 * same audited facts, and falls back to the template on any error.
 */
export async function generateLetter(
  audit: AuditResult,
  opts: GenerateLetterOptions = {},
): Promise<string> {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasKey) {
    return renderTemplateLetter(audit);
  }

  try {
    // Imported lazily so the offline/template path never needs the AI SDK.
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const modelId = opts.model ?? DEFAULT_MODEL;

    const { text } = await generateText({
      model: anthropic(modelId),
      system:
        "You are writing a letter to the editor of a medical journal in the exact " +
        "house style of the COMPare project (Goldacre et al.). Be polite but firm, " +
        "specific, and cite verbatim evidence. Do not invent outcomes, numbers, or " +
        "quotes beyond the audit facts supplied. Return only the letter text.",
      prompt: buildLlmPrompt(audit),
    });
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : renderTemplateLetter(audit);
  } catch {
    // Any failure (network, auth, SDK) degrades gracefully to the template.
    return renderTemplateLetter(audit);
  }
}

/* -------------------------------------------------------------------------- */
/* Shared fact extraction                                                     */
/* -------------------------------------------------------------------------- */

interface DroppedItem {
  measure: string;
  isPrimary: boolean;
  timeFrame?: string;
}
interface AddedItem {
  measure: string;
  verbatimQuote: string;
  section: string;
}

function registeredFor(audit: AuditResult, match: OutcomeMatch): RegisteredOutcome | undefined {
  if (match.registeredRef === null) return undefined;
  return audit.trialRecord.registeredOutcomes[match.registeredRef];
}
function reportedFor(audit: AuditResult, match: OutcomeMatch): ReportedOutcome | undefined {
  if (match.reportedRef === null) return undefined;
  return audit.reportedOutcomes[match.reportedRef];
}

/** Distil the audit's matches into the facts a letter needs. */
function collectFacts(audit: AuditResult) {
  const breakdown = scoreBreakdown(audit);
  const dropped: DroppedItem[] = [];
  const added: AddedItem[] = [];

  for (const match of audit.matches) {
    if (match.classification === "silently_dropped") {
      const reg = registeredFor(audit, match);
      if (reg) {
        dropped.push({
          measure: reg.measure,
          isPrimary: reg.type === "primary",
          timeFrame: reg.timeFrame,
        });
      }
    } else if (match.classification === "silently_added") {
      const rep = reportedFor(audit, match);
      if (rep) {
        added.push({
          measure: rep.measure,
          verbatimQuote: rep.verbatimQuote,
          section: rep.section,
        });
      }
    }
  }

  // Primary-first ordering makes the letter lead with the most serious drop.
  dropped.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  const faithful = breakdown.counts.faithful;
  const droppedCount = dropped.length;
  const addedCount = added.length;

  return { breakdown, dropped, added, faithful, droppedCount, addedCount };
}

function firstPublication(audit: AuditResult): string | undefined {
  return audit.trialRecord.resultPublicationRefs[0]?.citation;
}

/* -------------------------------------------------------------------------- */
/* LLM prompt (used only when a key is present)                               */
/* -------------------------------------------------------------------------- */

function buildLlmPrompt(audit: AuditResult): string {
  const { breakdown, dropped, added, faithful } = collectFacts(audit);
  const { trialRecord } = audit;
  const lines: string[] = [];

  lines.push("Write a COMPare-style letter to the editor about this trial.");
  lines.push("");
  lines.push(`Trial: ${trialRecord.title} (${trialRecord.nctId}).`);
  const cite = firstPublication(audit);
  if (cite) lines.push(`Results publication: ${cite}.`);
  lines.push(`Integrity score (0-100, our audit): ${breakdown.score}.`);
  lines.push("");
  lines.push(
    `Counts: ${faithful} outcome(s) correctly reported as prespecified; ` +
      `${dropped.length} prespecified outcome(s) silently dropped; ` +
      `${added.length} non-prespecified outcome(s) silently added.`,
  );
  if (dropped.length) {
    lines.push("");
    lines.push("Silently dropped (prespecified but not reported):");
    for (const d of dropped) {
      lines.push(
        `- [${d.isPrimary ? "PRIMARY" : "secondary"}] ${d.measure}` +
          (d.timeFrame ? ` (registered time frame: ${d.timeFrame})` : ""),
      );
    }
  }
  if (added.length) {
    lines.push("");
    lines.push("Silently added (reported but never prespecified):");
    for (const a of added) {
      lines.push(`- ${a.measure} — verbatim from ${a.section}: "${a.verbatimQuote}"`);
    }
  }
  lines.push("");
  lines.push(
    "Open by citing the trial, state the three counts, list the specific dropped " +
      "and added outcomes (quoting the verbatim evidence for added ones), note the " +
      "discrepancy politely but firmly, and close by requesting a correction. Do not " +
      "invent any facts beyond those above.",
  );
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Deterministic template letter (the offline fallback)                       */
/* -------------------------------------------------------------------------- */

function pluralOutcomes(n: number): string {
  return n === 1 ? "outcome" : "outcomes";
}

/**
 * Assemble the fallback letter as a pure string from the audit facts. No I/O,
 * no LLM — same input always yields the same letter.
 */
export function renderTemplateLetter(audit: AuditResult): string {
  const { breakdown, dropped, added, faithful, droppedCount, addedCount } = collectFacts(audit);
  const { trialRecord } = audit;
  const cite = firstPublication(audit);
  const droppedPrimary = dropped.filter((d) => d.isPrimary);

  const p: string[] = [];

  // Salutation.
  p.push("To the Editor,");

  // Opening: cite the trial and frame the concern.
  const openCite = cite ? ` reported by ${cite}` : "";
  p.push(
    `We write regarding the trial "${trialRecord.title}" (${trialRecord.nctId})${openCite}. ` +
      `We compared the outcomes prespecified in the trial's registry entry against those ` +
      `reported in the publication, and found discrepancies we believe warrant a correction.`,
  );

  // The headline counts.
  p.push(
    `In summary: ${faithful} prespecified ${pluralOutcomes(faithful)} ${faithful === 1 ? "was" : "were"} ` +
      `correctly reported as prespecified; ${droppedCount} prespecified ${pluralOutcomes(droppedCount)} ` +
      `${droppedCount === 1 ? "was" : "were"} silently dropped (registered but not reported); and ` +
      `${addedCount} non-prespecified ${pluralOutcomes(addedCount)} ${addedCount === 1 ? "was" : "were"} ` +
      `silently added (reported but never registered).`,
  );

  // Emphasise a dropped primary if present — the cardinal issue.
  if (droppedPrimary.length > 0) {
    const names = droppedPrimary.map((d) => `"${d.measure}"`).join("; ");
    p.push(
      `Of particular concern, ${droppedPrimary.length === 1 ? "a prespecified PRIMARY outcome was" : "prespecified PRIMARY outcomes were"} ` +
        `among those not reported: ${names}. The omission of a prespecified primary endpoint is a ` +
        `serious departure from the registered protocol.`,
    );
  }

  // Enumerate dropped outcomes.
  if (dropped.length > 0) {
    const items = dropped
      .map((d) => {
        const tag = d.isPrimary ? "primary" : "secondary";
        const tf = d.timeFrame ? ` (registered time frame: ${d.timeFrame})` : "";
        return `  - [${tag}] ${d.measure}${tf}`;
      })
      .join("\n");
    p.push(
      `Prespecified outcomes that do not appear to be reported in the publication:\n${items}`,
    );
  }

  // Enumerate added outcomes with verbatim evidence.
  if (added.length > 0) {
    const items = added
      .map((a) => `  - ${a.measure}\n      Reported in ${a.section}: "${a.verbatimQuote}"`)
      .join("\n");
    p.push(
      `Outcomes reported in the publication that we could not find prespecified in the registry:\n${items}`,
    );
  }

  // The polite-but-firm COMPare framing.
  p.push(
    `We recognise that there can be legitimate reasons for departing from a prespecified ` +
      `analysis plan. Where that is the case, best practice — and the CONSORT reporting ` +
      `guidelines — is to report every prespecified outcome and to declare any change from ` +
      `the registered protocol, together with the reason for it. We were unable to find such ` +
      `a declaration for the discrepancies above.`,
  );

  // Close: request a correction.
  p.push(
    `We would be grateful if the authors could either report the missing prespecified ` +
      `${pluralOutcomes(Math.max(droppedCount, 1))}, clearly flag the added ${pluralOutcomes(Math.max(addedCount, 1))} ` +
      `as non-prespecified, or publish a correction addressing these discrepancies. Correct and ` +
      `complete outcome reporting is essential to the integrity of the trial literature.`,
  );

  p.push("Yours faithfully,\nThe outcome-guard audit team");

  // Footer: transparency about how the number was derived.
  const termSummary = breakdown.terms
    .filter((t) => t.count > 0)
    .map((t) => `${t.label.toLowerCase()} −${Math.round(t.points)}`)
    .join("; ");
  p.push(
    `— Audit integrity score: ${breakdown.score}/100 ` +
      `(baseline ${breakdown.baseline}; total penalty −${Math.round(breakdown.totalPenalty)}` +
      `${termSummary ? `: ${termSummary}` : ""}).`,
  );

  return p.join("\n\n");
}
