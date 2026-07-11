/**
 * Ingestion: uploaded-PDF -> plain text (fallback path).
 *
 * This is only used when a results paper is supplied as a PDF upload rather than
 * being resolvable via Europe PMC. The demo trial's paper is already
 * pre-extracted into `fixtures/paper.NCT01951625.json`, so this path is rarely hit.
 *
 * No PDF-parsing dependency (`pdfjs-dist` / `pdf-parse`) is installed, and adding
 * one is out of scope for this track. Until a dependency is added, this function
 * throws a clear, actionable error rather than silently returning nothing.
 */

/** Normalize the accepted input types to a Uint8Array (no copy when possible). */
function toBytes(input: Uint8Array | ArrayBuffer | Buffer): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  // Buffer is a Uint8Array subclass at runtime, but keep this for type safety.
  return new Uint8Array(input as ArrayBuffer);
}

/**
 * Extract text from a PDF supplied as bytes.
 *
 * NOTE: PDF extraction requires a parsing library (`pdfjs-dist` or `pdf-parse`),
 * which is not currently a dependency of this project. This function validates
 * its input and then throws with installation guidance. Wire in the library here
 * (dynamic `import`) once it is added to `package.json`.
 */
export async function pdfToText(input: Uint8Array | ArrayBuffer | Buffer): Promise<string> {
  const bytes = toBytes(input);

  // Cheap sanity check so callers get a useful message for obviously-bad input.
  const header = new TextDecoder("latin1").decode(bytes.subarray(0, 5));
  if (header !== "%PDF-") {
    throw new Error(
      `pdfToText: input does not look like a PDF (missing "%PDF-" header, got ${JSON.stringify(header)}).`,
    );
  }

  throw new Error(
    "PDF extraction requires a parsing library (pdfjs-dist or pdf-parse); not installed. " +
      "Add one to package.json and dynamically import it in src/lib/ingest/pdf.ts. " +
      "For the demo, use the pre-extracted fixtures/paper.NCT01951625.json instead.",
  );
}
