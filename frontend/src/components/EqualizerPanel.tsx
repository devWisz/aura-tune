"use client";

import React, { useEffect, useRef } from "react";
import { useAudioStore, DEFAULT_PRESETS } from "@/store/useAudioStore";
import { EQ_FREQUENCIES } from "@/lib/audio/biquadFilterBank";

export const EqualizerPanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { eqGains, setEQGain, activePresetId, applyPreset, reverbPreset, setReverbPreset } = useAudioStore();

  // Draw Spline Curve on Canvas when EQ gains change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 16;
    const usableWidth = width - padding * 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw Subtle Grid Lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    // Zero dB center line
    ctx.beginPath();
    ctx.moveTo(padding, centerY);
    ctx.lineTo(width - padding, centerY);
    ctx.stroke();

    // Map EQ Gains to Coordinates
    const points = eqGains.map((gain, i) => {
      const x = padding + (i / (eqGains.length - 1)) * usableWidth;
      const y = centerY - (gain / 24) * (centerY - 12);
      return { x, y };
    });

    // Draw Spline Curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Frequency Control Points
    points.forEach((pt) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [eqGains]);

  return (
    <div className="bg-[#10121a] rounded-xl border border-zinc-800/80 p-6 space-y-6">
      {/* Header & Spatial Room Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-white uppercase">
            10-Band Parametric Equalizer
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Cascading Biquad Filter Frequency Shaping</p>
        </div>

        {/* Spatial Room Selector */}
        <div className="flex items-center space-x-1.5 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
          <span className="text-xs text-zinc-400 px-2 font-mono uppercase">Reverb:</span>
          {(["none", "room", "hall", "cathedral"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setReverbPreset(mode)}
              className={`px-2.5 py-1 rounded text-xs capitalize transition ${
                reverbPreset === mode
                  ? "bg-zinc-100 text-black font-medium"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Preset Quick Selector */}
      <div className="flex flex-wrap gap-2">
        {DEFAULT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              activePresetId === preset.id
                ? "bg-zinc-100 text-black border-white"
                : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700"
            }`}
          >
            {preset.name}
          </button>
        ))}

        <button
          onClick={() =>
            applyPreset({
              id: "flat-neutral",
              name: "Flat & Neutral",
              description: "Flat response",
              headphoneModel: "Studio",
              eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              reverbPreset: "none",
              author: "System",
              likes: 0,
            })
          }
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900/60 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700 transition ml-auto"
        >
          Reset Flat
        </button>
      </div>

      {/* Frequency Response Spline Canvas */}
      <div className="bg-[#090a0f] rounded-lg border border-zinc-800/80 p-3 overflow-hidden">
        <canvas ref={canvasRef} width={700} height={100} className="w-full h-24 block" />
        <div className="flex justify-between px-4 text-[10px] font-mono text-zinc-500 mt-1">
          <span>20Hz</span>
          <span>100Hz</span>
          <span>1kHz</span>
          <span>5kHz</span>
          <span>20kHz</span>
        </div>
      </div>

      {/* 10 Band Sliders */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 pt-1">
        {EQ_FREQUENCIES.map((freq, index) => {
          const gain = eqGains[index] || 0;
          const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;

          return (
            <div
              key={freq}
              className="flex flex-col items-center bg-[#090a0f] p-3 rounded-lg border border-zinc-800/60 space-y-3"
            >
              <span className="text-[11px] font-mono text-zinc-300">
                {gain > 0 ? `+${gain}` : gain}dB
              </span>

              <div className="h-32 flex items-center">
                <input
                  type="range"
                  min="-24"
                  max="24"
                  step="0.5"
                  value={gain}
                  onChange={(e) => setEQGain(index, parseFloat(e.target.value))}
                  className="h-28 w-1.5 appearance-none bg-zinc-800 rounded cursor-pointer accent-white [writing-mode:vertical-lr] [direction:rtl]"
                />
              </div>

              <span className="text-[10px] font-mono text-zinc-500 uppercase">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
