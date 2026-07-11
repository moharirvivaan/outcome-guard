import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { ReportedOutcomeSchema, type ReportedOutcome } from "@/lib/contract";

/**
 * Extraction pass (Subagent B, step 1).
 *
 * Reads the results-publication text and pulls out every outcome the paper
 * actually reports, each backed by a VERBATIM quote so the downstream audit is
 * fully evidence-linked. Uses `generateObject` with Sonnet.
 *
 * The model is instructed to copy `verbatimQuote` character-for-character from
 * the paper — never paraphrase — so a reader can Ctrl-F the quote in the source.
 */

const MODEL = "claude-sonnet-5";

/** A paper as either a flat string or the structured section array of the fixture. */
export type PaperInput =
  | string
  | { sections: { section: string; text: string }[] };

/** Wrapper schema — generateObject needs an object at the top level. */
const ExtractionSchema = z.object({
  outcomes: z.array(ReportedOutcomeSchema),
});

/** Normalize the paper input into a single labeled-section string for the prompt. */
function renderPaper(paper: PaperInput): string {
  if (typeof paper === "string") return paper;
  return paper.sections
    .map((s) => `### ${s.section}\n${s.text}`)
    .join("\n\n");
}

const SYSTEM_PROMPT = `You are a meticulous clinical-trial methodologist extracting the OUTCOMES (end points) that a results publication actually reports.

Your job: read the paper text and list every distinct outcome/end point the paper REPORTS RESULTS FOR — primary, secondary, exploratory, safety, composites, individual biomarkers, echocardiographic measures, vital signs, clinical events. If the paper states a numeric result, a comparison, a rate, or a P value for something, it is a reported outcome.

Rules:
- One entry per distinct outcome measure. Do NOT merge distinct measures (e.g. "LVEF" and "LVEDV" are two outcomes, not one). Do NOT split a single measure into per-dose rows — dose-level breakdowns of the same measure are the SAME outcome.
- "measure" = a concise canonical name of the outcome as the paper frames it (e.g. "Change in log-transformed NT-proBNP, baseline to week 12").
- "verbatimQuote" = text copied CHARACTER-FOR-CHARACTER from the paper that reports this outcome. NEVER paraphrase, summarize, or fabricate. It must be findable via exact string search in the source. Prefer the sentence that carries the result/number.
- "section" = the section label where the quote appears (use the "### " heading given in the input, e.g. "Results — Primary End Point", "Table 3").
- Capture outcomes that appear only in tables too (each table row family = one outcome).
- Be exhaustive: exploratory and newly-introduced outcomes matter as much as prespecified ones.`;

/**
 * Extract reported outcomes from paper text.
 *
 * @throws if ANTHROPIC_API_KEY is missing (the SDK will surface an auth error).
 *         Callers that must degrade gracefully should guard on the env var.
 */
export async function extractReported(
  paper: PaperInput
): Promise<ReportedOutcome[]> {
  const paperText = renderPaper(paper);

  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: ExtractionSchema,
    maxOutputTokens: 4096,
    system: SYSTEM_PROMPT,
    prompt: `Extract every reported outcome from this results publication.\n\n${paperText}`,
  });

  // Validate against the contract (belt-and-suspenders: generateObject already
  // conforms to the schema, but we re-parse so the boundary is explicit).
  return object.outcomes.map((o) => ReportedOutcomeSchema.parse(o));
}
