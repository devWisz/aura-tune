"use client";

import React, { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { audioEngine } from "@/lib/audio/audioEngine";
import { startVisualizer, VISUALIZER_MODES } from "@/lib/audio/visualizerRenderer";
import { OutputMeter } from "@/components/OutputMeter";
import { Panel, Segmented } from "@/components/ui/Primitives";

export const VisualizerPanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { visualizerMode, setVisualizerMode, isPlaying, isNoiseActive, isMicActive } = useAudioStore();
  const [live, setLive] = useState(false);

  // The analyser only exists once the engine has been initialised by a user
  // gesture, so wait for it rather than silently rendering nothing.
  const modeRef = useRef(visualizerMode);
  modeRef.current = visualizerMode;

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;

    const attach = () => {
      if (cancelled || stop) return true;
      const canvas = canvasRef.current;
      const analyser = audioEngine.getAnalyser();
      if (!canvas || !analyser) return false;

      stop = startVisualizer(canvas, analyser, () => modeRef.current);
      setLive(true);
      return true;
    };

    if (!attach()) {
      const poll = window.setInterval(() => {
        if (attach()) window.clearInterval(poll);
      }, 400);
      return () => {
        cancelled = true;
        window.clearInterval(poll);
        stop?.();
      };
    }

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const hasSignal = isPlaying || isNoiseActive || isMicActive;

  return (
    <Panel
      title="Spectrum Analyser"
      subtitle="Log-frequency FFT with peak hold"
      icon={<Radio size={15} />}
      actions={
        <Segmented
          size="xs"
          value={visualizerMode}
          options={VISUALIZER_MODES}
          onChange={setVisualizerMode}
        />
      }
      bodyClassName="space-y-3"
    >
      <div className="at-inset relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block h-[220px] w-full sm:h-[268px]"
          role="img"
          aria-label={`${visualizerMode} visualisation of the output signal`}
        />

        {!hasSignal && (
          <div className="absolute inset-0 grid place-items-center bg-sunken/80 px-6 text-center backdrop-blur-[2px]">
            <div>
              <p className="text-[12px] font-medium text-dim">
                {live ? "Engine idle" : "Audio engine on standby"}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-faint">
                Load a track, enable the microphone, or start a noise bed to see the spectrum.
              </p>
            </div>
          </div>
        )}
      </div>

      <OutputMeter />
    </Panel>
  );
};
