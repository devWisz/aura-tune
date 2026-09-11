"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useAudioStore, DEFAULT_PRESETS } from "@/store/useAudioStore";
import {
  EQ_FREQUENCIES,
  EQ_MAX_DB,
  EQ_MIN_DB,
  approximateResponseCurve,
  ResponseArray,
} from "@/lib/audio/biquadFilterBank";
import { audioEngine } from "@/lib/audio/audioEngine";
import { Button, Panel, Segmented, Slider } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

const MIN_HZ = 20;
const MAX_HZ = 20000;
const CURVE_POINTS = 240;
const PAD = { left: 30, right: 10, top: 12, bottom: 20 };

const formatHz = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`);

/** Log-spaced frequency axis, shared by the curve sampler and the renderer. */
function makeFrequencyAxis(): ResponseArray {
  const freqs = new Float32Array(CURVE_POINTS);
  const logMin = Math.log10(MIN_HZ);
  const logMax = Math.log10(MAX_HZ);
  for (let i = 0; i < CURVE_POINTS; i++) {
    freqs[i] = Math.pow(10, logMin + ((logMax - logMin) * i) / (CURVE_POINTS - 1));
  }
  return freqs as ResponseArray;
}

export const EqualizerPanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const axisRef = useRef<ResponseArray>(makeFrequencyAxis());
  const dragBandRef = useRef<number | null>(null);
  const [hoverBand, setHoverBand] = useState<number | null>(null);

  const {
    eqGains,
    setEQGain,
    nudgeEQGain,
    activePresetId,
    applyPreset,
    resetEQ,
    eqBypassed,
    dsp,
    setDsp,
  } = useAudioStore();

  /* ---------------- Canvas geometry helpers ---------------- */

  const xForFreq = useCallback((hz: number, width: number) => {
    const t = (Math.log10(hz) - Math.log10(MIN_HZ)) / (Math.log10(MAX_HZ) - Math.log10(MIN_HZ));
    return PAD.left + t * (width - PAD.left - PAD.right);
  }, []);

  const yForDb = useCallback((db: number, height: number) => {
    const plotHeight = height - PAD.top - PAD.bottom;
    const t = (EQ_MAX_DB - db) / (EQ_MAX_DB - EQ_MIN_DB);
    return PAD.top + t * plotHeight;
  }, []);

  const dbForY = useCallback((y: number, height: number) => {
    const plotHeight = height - PAD.top - PAD.bottom;
    const t = (y - PAD.top) / plotHeight;
    return EQ_MAX_DB - t * (EQ_MAX_DB - EQ_MIN_DB);
  }, []);

  /* ---------------- Renderer ---------------- */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 200;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const plotRight = width - PAD.right;

    // --- dB grid ---
    ctx.font = "9px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    for (const db of [12, 6, 0, -6, -12]) {
      const y = yForDb(db, height);
      ctx.strokeStyle = db === 0 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.055)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "right";
      ctx.fillText(db > 0 ? `+${db}` : `${db}`, PAD.left - 6, y);
    }

    // --- Frequency grid ---
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const hz of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
      const x = xForFreq(hz, width);
      ctx.strokeStyle = "rgba(255,255,255,0.045)";
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, height - PAD.bottom);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText(formatHz(hz), Math.min(Math.max(x, PAD.left + 8), plotRight - 8), height - 6);
    }

    // --- Response curve, measured from the live filters when they exist ---
    const axis = axisRef.current;
    const measured = audioEngine.getEQResponse(axis);
    const curve = measured ?? approximateResponseCurve(eqGains, axis);

    const points = Array.from(curve, (db, i) => ({
      x: xForFreq(axis[i], width),
      y: yForDb(Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, db)), height),
    }));

    const zeroY = yForDb(0, height);
    const accent = eqBypassed ? "148, 152, 168" : "56, 208, 255";

    // Filled area between the curve and 0 dB
    ctx.beginPath();
    ctx.moveTo(points[0].x, zeroY);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, zeroY);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, PAD.top, 0, height - PAD.bottom);
    fill.addColorStop(0, `rgba(${accent}, 0.26)`);
    fill.addColorStop(0.5, `rgba(${accent}, 0.06)`);
    fill.addColorStop(1, `rgba(149, 122, 255, 0.2)`);
    ctx.fillStyle = fill;
    ctx.fill();

    // Curve stroke, with a soft glow underneath
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = `rgba(${accent}, 0.2)`;
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.strokeStyle = `rgba(${accent}, ${eqBypassed ? 0.5 : 1})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Draggable band handles ---
    EQ_FREQUENCIES.forEach((hz, i) => {
      const x = xForFreq(hz, width);
      const y = yForDb(Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, eqGains[i] ?? 0)), height);
      const isHot = hoverBand === i || dragBandRef.current === i;

      ctx.beginPath();
      ctx.moveTo(x, zeroY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = `rgba(${accent}, ${isHot ? 0.55 : 0.22})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, isHot ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isHot ? "#ffffff" : `rgba(${accent}, 0.95)`;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(8,9,13,0.9)";
      ctx.stroke();
    });
  }, [eqGains, eqBypassed, hoverBand, xForFreq, yForDb]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Redraw on resize — the canvas is fluid-width.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  /* ---------------- Pointer interaction ---------------- */

  const bandAtX = useCallback(
    (x: number, width: number): number => {
      let nearest = 0;
      let best = Infinity;
      EQ_FREQUENCIES.forEach((hz, i) => {
        const distance = Math.abs(xForFreq(hz, width) - x);
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      });
      return best < 34 ? nearest : -1;
    },
    [xForFreq]
  );

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, width: rect.width, height: rect.height };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y, width, height } = pointerPos(e);
    const band = bandAtX(x, width);
    if (band < 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    dragBandRef.current = band;
    setHoverBand(band);
    setEQGain(band, Math.round(dbForY(y, height) * 2) / 2);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y, width, height } = pointerPos(e);
    const band = dragBandRef.current;

    if (band === null) {
      setHoverBand(bandAtX(x, width) >= 0 ? bandAtX(x, width) : null);
      return;
    }
    setEQGain(band, Math.round(dbForY(y, height) * 2) / 2);
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragBandRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
    dragBandRef.current = null;
  };

  const presetOptions = DEFAULT_PRESETS.slice(0, 6);

  return (
    <Panel
      title="10-Band Parametric Equalizer"
      subtitle={
        eqBypassed
          ? "Bypassed — you are hearing the untouched signal"
          : "Tuned for the JBL Tune 730BT — drag the curve or the faders, changes are audible immediately"
      }
      icon={<SlidersHorizontal size={15} />}
      actions={
        <>
          <span className="at-mono hidden text-[10px] text-faint sm:inline">
            Preamp {dsp.preampDb > 0 ? "+" : ""}
            {dsp.preampDb.toFixed(1)} dB
          </span>
          <Button variant="ghost" onClick={resetEQ}>
            <RotateCcw size={13} /> Flat
          </Button>
        </>
      }
      bodyClassName="space-y-4"
    >
      {/* Preset shortcuts */}
      <div className="flex flex-wrap items-center gap-1.5">
        {presetOptions.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            className={cn(
              "at-focus rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
              activePresetId === preset.id
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-line-soft bg-white/[0.02] text-faint hover:border-line hover:text-dim"
            )}
          >
            {preset.name}
          </button>
        ))}
        {activePresetId === "custom" && (
          <span className="at-mono inline-flex items-center gap-1 rounded-lg border border-accent2/40 bg-accent2/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-accent2">
            <Sparkles size={10} /> Custom
          </span>
        )}
      </div>

      {/* Response curve */}
      <div className="at-inset overflow-hidden p-1">
        <canvas
          ref={canvasRef}
          className={cn(
            "block h-[190px] w-full touch-none sm:h-[220px]",
            hoverBand !== null ? "cursor-ns-resize" : "cursor-crosshair"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={(e) => {
            endDrag(e);
            setHoverBand(null);
          }}
          role="img"
          aria-label="Equalizer frequency response curve"
        />
      </div>

      {/* Faders */}
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {EQ_FREQUENCIES.map((freq, index) => {
          const gain = eqGains[index] ?? 0;
          const isHot = hoverBand === index;

          return (
            <div
              key={freq}
              onMouseEnter={() => setHoverBand(index)}
              onMouseLeave={() => setHoverBand(null)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border px-1 py-2.5 transition-colors",
                isHot ? "border-accent/40 bg-accent/[0.06]" : "border-line-soft bg-sunken/60"
              )}
            >
              <span
                className={cn(
                  "at-mono text-[10px]",
                  gain === 0 ? "text-faint" : gain > 0 ? "text-accent" : "text-accent2"
                )}
              >
                {gain > 0 ? "+" : ""}
                {gain.toFixed(1)}
              </span>

              <input
                type="range"
                className="at-fader h-24"
                min={EQ_MIN_DB}
                max={EQ_MAX_DB}
                step={0.5}
                value={gain}
                aria-label={`${formatHz(freq)} hertz band gain`}
                onChange={(e) => setEQGain(index, parseFloat(e.target.value))}
                onKeyDown={(e) => {
                  // Shift for fine 0.5 dB steps, otherwise 1 dB.
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const magnitude = e.shiftKey ? 0.5 : 1;
                    nudgeEQGain(index, e.key === "ArrowUp" ? magnitude : -magnitude);
                  }
                }}
              />

              <button
                onDoubleClick={() => setEQGain(index, 0)}
                onClick={() => setEQGain(index, 0)}
                title="Reset this band to 0 dB"
                className="at-focus at-mono rounded px-1 text-[9px] uppercase tracking-wider text-faint transition-colors hover:text-ink"
              >
                {formatHz(freq)}
              </button>
            </div>
          );
        })}
      </div>

      {/* Band width + preamp */}
      <div className="grid gap-4 border-t border-line-soft pt-4 sm:grid-cols-2">
        <Slider
          label="Band width (Q)"
          value={dsp.eqQ}
          min={0.4}
          max={4}
          step={0.01}
          onChange={(v) => setDsp("eqQ", v)}
          format={(v) => (v < 1 ? `${v.toFixed(2)} · wide` : v > 2 ? `${v.toFixed(2)} · narrow` : v.toFixed(2))}
        />
        <div className="space-y-1.5">
          <Slider
            label="Preamp"
            value={dsp.preampDb}
            min={-18}
            max={6}
            step={0.5}
            onChange={(v) => setDsp("preampDb", v)}
            format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`}
            disabled={dsp.autoGain}
          />
          <Segmented
            size="xs"
            value={dsp.autoGain ? "auto" : "manual"}
            options={[
              { id: "auto", label: "Auto gain" },
              { id: "manual", label: "Manual" },
            ]}
            onChange={(id) => setDsp("autoGain", id === "auto")}
          />
        </div>
      </div>
    </Panel>
  );
};
