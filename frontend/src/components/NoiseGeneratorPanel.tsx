"use client";

import React from "react";
import { useAudioStore } from "@/store/useAudioStore";
import { NoiseColor } from "@/lib/audio/noiseSynthesizer";

export const NoiseGeneratorPanel: React.FC = () => {
  const {
    isNoiseActive,
    noiseColor,
    noiseVolume,
    toggleNoise,
    setNoiseColor,
    setNoiseVolume,
    isBinauralActive,
    toggleBinaural,
    setBinauralParams,
  } = useAudioStore();

  return (
    <div className="bg-[#10121a] rounded-xl border border-zinc-800/80 p-6 space-y-6">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-white uppercase">
            Focus & Noise Generator
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Procedural Sound Synthesis & Binaural Carrier</p>
        </div>

        <button
          onClick={toggleNoise}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition ${
            isNoiseActive
              ? "bg-zinc-100 text-black border-white"
              : "bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:border-zinc-700"
          }`}
        >
          {isNoiseActive ? "Noise Enabled" : "Enable Noise"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Procedural Color Noise Section */}
        <div className="bg-[#090a0f] p-4 rounded-lg border border-zinc-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Color Noise</span>
            <span className="text-[10px] font-mono text-zinc-400 uppercase">{noiseColor}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["white", "pink", "brown"] as NoiseColor[]).map((color) => (
              <button
                key={color}
                onClick={() => setNoiseColor(color)}
                className={`py-1.5 rounded text-xs capitalize font-medium border transition ${
                  noiseColor === color
                    ? "bg-zinc-100 text-black border-white"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                }`}
              >
                {color}
              </button>
            ))}
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs text-zinc-400 font-mono">
              <span>Intensity</span>
              <span>{Math.round(noiseVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={noiseVolume}
              onChange={(e) => setNoiseVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>

        {/* Binaural Beats Generator */}
        <div className="bg-[#090a0f] p-4 rounded-lg border border-zinc-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Binaural Carrier</span>
            <button
              onClick={toggleBinaural}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                isBinauralActive
                  ? "bg-zinc-100 text-black border-white"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
              }`}
            >
              {isBinauralActive ? "On (10Hz)" : "Off"}
            </button>
          </div>

          <p className="text-[11px] text-zinc-400">
            Produces a 10Hz Alpha wave frequency offset between drivers for concentration.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <button
              onClick={() => setBinauralParams(200, 10, 0.15)}
              className="p-2 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left"
            >
              <div className="font-semibold text-zinc-200">Alpha (10Hz)</div>
              <div className="text-[10px] text-zinc-500 font-mono">Focus</div>
            </button>

            <button
              onClick={() => setBinauralParams(150, 4, 0.15)}
              className="p-2 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left"
            >
              <div className="font-semibold text-zinc-200">Theta (4Hz)</div>
              <div className="text-[10px] text-zinc-500 font-mono">Relaxation</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
