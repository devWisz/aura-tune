"use client";

import React, { useEffect, useRef } from "react";
import { useAudioStore } from "@/store/useAudioStore";
import { audioEngine } from "@/lib/audio/audioEngine";
import { drawSpectrumVisualizer } from "@/lib/audio/visualizerRenderer";

export const VisualizerPanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { visualizerMode, setVisualizerMode, isPlaying } = useAudioStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const analyser = audioEngine.getAnalyser();
    if (!analyser) return;

    const cleanup = drawSpectrumVisualizer(canvas, analyser, visualizerMode);
    return () => {
      cleanup();
    };
  }, [visualizerMode, isPlaying]);

  return (
    <div className="bg-[#10121a] rounded-xl border border-zinc-800/80 p-6 space-y-4">
      {/* Header & Mode Switcher */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <h2 className="text-sm font-semibold tracking-wider text-white uppercase">
          Frequency Spectrum
        </h2>

        <div className="flex items-center space-x-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setVisualizerMode("spectrum")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              visualizerMode === "spectrum"
                ? "bg-zinc-100 text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Spectrum
          </button>

          <button
            onClick={() => setVisualizerMode("waveform")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              visualizerMode === "waveform"
                ? "bg-zinc-100 text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Waveform
          </button>

          <button
            onClick={() => setVisualizerMode("circular")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              visualizerMode === "circular"
                ? "bg-zinc-100 text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Vortex
          </button>
        </div>
      </div>

      {/* Canvas Display */}
      <div className="relative bg-[#090a0f] rounded-lg border border-zinc-800/80 overflow-hidden h-60 flex items-center justify-center">
        <canvas ref={canvasRef} width={800} height={240} className="w-full h-full block" />

        {!isPlaying && (
          <div className="absolute inset-0 bg-[#090a0f]/90 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">Audio Engine Standby</p>
            <p className="text-[11px] text-zinc-500 max-w-xs mt-1">
              Load an audio track or activate microphone input to render spectrum data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
