"use client";

/**
 * ScoreGauge — a large, prominent integrity score (0–100) rendered as a big
 * number inside a colored SVG arc. The displayed value tweens toward whatever
 * `score` prop it is given, so callers can feed it a *running* score that
 * climbs down as red/amber rows land and settles on the final integrityScore.
 */
import { useEffect, useRef, useState } from "react";
import { scoreColor } from "./outcomePresentation";

interface ScoreGaugeProps {
  /** Target score, 0–100. The gauge animates toward this value. */
  score: number;
  /** Optional label under the number (e.g. count of issues). */
  caption?: string;
}

const RADIUS = 84;
const CIRC = Math.PI * RADIUS; // half-circle arc length

export default function ScoreGauge({ score, caption }: ScoreGaugeProps) {
  const [display, setDisplay] = useState(score);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(score);
  const startRef = useRef(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();
    const from = fromRef.current;
    const to = score;
    const duration = 550;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const clamped = Math.max(0, Math.min(100, display));
  const rounded = Math.round(clamped);
  const { hex, label, textClass } = scoreColor(rounded);
  const filled = (clamped / 100) * CIRC;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg
          width="200"
          height="120"
          viewBox="0 0 200 120"
          role="img"
          aria-label={`Integrity score ${rounded} out of 100, ${label}`}
        >
          {/* track */}
          <path
            d="M 16 108 A 84 84 0 0 1 184 108"
            fill="none"
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* value arc */}
          <path
            d="M 16 108 A 84 84 0 0 1 184 108"
            fill="none"
            stroke={hex}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC - filled}
            style={{ transition: "stroke 300ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span
            className={`text-6xl font-bold tabular-nums leading-none ${textClass}`}
          >
            {rounded}
          </span>
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            / 100
          </span>
        </div>
      </div>
      <div className="mt-1 text-center">
        <div className={`text-sm font-semibold ${textClass}`}>{label}</div>
        <div className="text-xs text-zinc-500">Integrity score</div>
        {caption ? (
          <div className="mt-1 text-xs text-zinc-500">{caption}</div>
        ) : null}
      </div>
    </div>
  );
}
