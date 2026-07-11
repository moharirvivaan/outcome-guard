"use client";

/**
 * useAuditStream — client hook that drives a live audit against POST /api/audit
 * and exposes the incrementally-built state for the UI.
 *
 * It consumes the route's newline-delimited-JSON `AuditEvent` stream, updating
 * React state as each event lands so OutcomeLedger rows and the ScoreGauge can
 * render live. All failure paths surface as `status: "error"` with a message,
 * never a thrown crash.
 */
import { useCallback, useRef, useState } from "react";
import type {
  AuditEvent,
  AuditRequest,
  AuditResult,
  OutcomeMatch,
  ReportedOutcome,
  TrialRecord,
} from "@/lib/contract";
import { PRESENTATION } from "./outcomePresentation";

export type AuditStatus =
  | "idle"
  | "connecting"
  | "registry"
  | "paper"
  | "extracting"
  | "reported"
  | "matching"
  | "done"
  | "error";

export interface AuditStreamState {
  status: AuditStatus;
  /** Human-readable note about the current phase, for the UI. */
  phase: string;
  trial: TrialRecord | null;
  paperMeta: string | null;
  reportedOutcomes: ReportedOutcome[];
  /** Matches received so far, in arrival order. */
  matches: OutcomeMatch[];
  /**
   * Running integrity score for the gauge: starts at 100 and drops by each
   * arriving match's penalty so the gauge animates DOWN as damning rows land,
   * then settles on the authoritative `score` from the scored/done events.
   */
  runningScore: number;
  /** Authoritative integrity score once scored (100 until then). */
  score: number;
  /** The final assembled result once `status === "done"`. */
  result: AuditResult | null;
  errorMessage: string | null;
}

const INITIAL: AuditStreamState = {
  status: "idle",
  phase: "",
  trial: null,
  paperMeta: null,
  reportedOutcomes: [],
  matches: [],
  runningScore: 100,
  score: 100,
  result: null,
  errorMessage: null,
};

export function useAuditStream() {
  const [state, setState] = useState<AuditStreamState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const apply = useCallback((event: AuditEvent) => {
    setState((s) => {
      switch (event.stage) {
        case "registry":
          return { ...s, status: "registry", phase: "Registry loaded", trial: event.trial };
        case "paper":
          return {
            ...s,
            status: "paper",
            phase: `Paper resolved (${event.meta.section})`,
            paperMeta: event.meta.source,
          };
        case "extracting":
          return { ...s, status: "extracting", phase: "Extracting reported outcomes…" };
        case "reported":
          return {
            ...s,
            status: "reported",
            phase: `Extracted ${event.reportedOutcomes.length} reported outcomes`,
            reportedOutcomes: event.reportedOutcomes,
          };
        case "matching":
          return { ...s, status: "matching", phase: "Matching registered vs reported…" };
        case "match": {
          const penalty = PRESENTATION[event.match.classification]?.penalty ?? 0;
          return {
            ...s,
            status: "matching",
            phase: `Matching outcomes… ${event.index}/${event.total}`,
            matches: [...s.matches, event.match],
            // Drop the running score as each damning row lands.
            runningScore: Math.max(0, s.runningScore - penalty),
          };
        }
        case "scored":
          // Settle the gauge on the authoritative score.
          return { ...s, score: event.integrityScore, runningScore: event.integrityScore };
        case "done":
          return {
            ...s,
            status: "done",
            phase: "Audit complete",
            result: event.auditResult,
            score: event.auditResult.integrityScore,
            runningScore: event.auditResult.integrityScore,
            // Ensure the ledger shows the authoritative final match set.
            matches: event.auditResult.matches,
            reportedOutcomes: event.auditResult.reportedOutcomes,
            trial: event.auditResult.trialRecord,
          };
        case "error":
          return {
            ...s,
            status: "error",
            phase: "Audit failed",
            errorMessage: event.message,
          };
        default:
          return s;
      }
    });
  }, []);

  const start = useCallback(
    async (req: AuditRequest) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ ...INITIAL, status: "connecting", phase: "Contacting the registry…" });

      try {
        const res = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
          signal: controller.signal,
        });

        if (!res.ok && !res.body) {
          const text = await res.text().catch(() => "");
          setState((s) => ({
            ...s,
            status: "error",
            phase: "Audit failed",
            errorMessage: text || `Request failed (${res.status})`,
          }));
          return;
        }
        if (!res.body) {
          setState((s) => ({ ...s, status: "error", errorMessage: "No response stream." }));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Read the NDJSON stream, dispatching one event per complete line.
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line.length === 0) continue;
            dispatchLine(line, apply);
          }
        }
        // Flush any trailing partial line.
        const tail = buffer.trim();
        if (tail.length > 0) dispatchLine(tail, apply);
      } catch (err) {
        if (controller.signal.aborted) return; // intentional reset, not an error
        setState((s) => ({
          ...s,
          status: "error",
          phase: "Audit failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [apply],
  );

  return { state, start, reset };
}

function dispatchLine(line: string, apply: (event: AuditEvent) => void) {
  let event: AuditEvent;
  try {
    event = JSON.parse(line) as AuditEvent;
  } catch {
    // Ignore a malformed line rather than crash the whole audit.
    return;
  }
  apply(event);
}
