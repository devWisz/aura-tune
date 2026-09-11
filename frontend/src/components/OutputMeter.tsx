"use client";

import React, { useEffect, useRef, useState } from "react";
import { audioEngine } from "@/lib/audio/audioEngine";
import { cn } from "@/lib/cn";

const FLOOR_DB = -54;

/** Maps dBFS onto 0–1 with more resolution near the top, like a real meter. */
function dbToPercent(db: number): number {
  if (!Number.isFinite(db) || db < FLOOR_DB) return 0;
  return Math.min(1, (db - FLOOR_DB) / -FLOOR_DB);
}

const Bar: React.FC<{ level: number; peak: number; label: string }> = ({ level, peak, label }) => (
  <div className="flex items-center gap-2">
    <span className="at-label w-3">{label}</span>
    <div className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-sunken ring-1 ring-inset ring-line-soft">
      <div
        className="h-full rounded-full transition-[width] duration-75"
        style={{
          width: `${level * 100}%`,
          background:
            level > 0.93
              ? "rgb(var(--danger))"
              : level > 0.8
              ? "linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent-warm)))"
              : "linear-gradient(90deg, rgb(var(--accent) / 0.55), rgb(var(--accent)))",
        }}
      />
      {peak > 0 && (
        <div
          className="absolute top-0 h-full w-[2px] rounded bg-white/85"
          style={{ left: `calc(${Math.min(peak, 1) * 100}% - 1px)` }}
        />
      )}
    </div>
  </div>
);

/**
 * Live L/R peak meter with a slow-falling peak-hold marker and a clip light.
 * Reads straight from the engine's analysers on rAF; it never touches the store,
 * so 60 fps metering does not re-render the rest of the studio.
 */
export const OutputMeter: React.FC<{ className?: string }> = ({ className }) => {
  const [levels, setLevels] = useState({ l: 0, r: 0, peakL: 0, peakR: 0, clipped: false });
  const state = useRef({ peakL: 0, peakR: 0, clipUntil: 0 });

  useEffect(() => {
    let raf = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);

      const { left, right } = audioEngine.getPeakLevels();
      const l = dbToPercent(left);
      const r = dbToPercent(right);
      const now = performance.now();

      state.current.peakL = Math.max(l, state.current.peakL - 0.004);
      state.current.peakR = Math.max(r, state.current.peakR - 0.004);
      if (left > -0.3 || right > -0.3) state.current.clipUntil = now + 1200;

      setLevels({
        l,
        r,
        peakL: state.current.peakL,
        peakR: state.current.peakR,
        clipped: now < state.current.clipUntil,
      });
    };

    tick();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="at-label">Output</span>
        <span
          className={cn(
            "at-mono rounded px-1.5 py-[2px] text-[9px] uppercase tracking-wider transition-colors",
            levels.clipped ? "bg-danger/20 text-danger" : "text-faint"
          )}
        >
          {levels.clipped ? "Clip" : "0 dBFS"}
        </span>
      </div>
      <Bar level={levels.l} peak={levels.peakL} label="L" />
      <Bar level={levels.r} peak={levels.peakR} label="R" />
    </div>
  );
};
