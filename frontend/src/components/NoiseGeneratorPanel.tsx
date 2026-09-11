"use client";

import React from "react";
import { Brain, CloudRain, Power } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { NOISE_COLORS, NoiseColor } from "@/lib/audio/noiseSynthesizer";
import { Button, Panel, Slider } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

const BRAINWAVE_PRESETS = [
  { label: "Delta", beat: 2, base: 120, blurb: "Deep rest" },
  { label: "Theta", beat: 5, base: 150, blurb: "Meditation" },
  { label: "Alpha", beat: 10, base: 200, blurb: "Relaxed focus" },
  { label: "Beta", beat: 18, base: 240, blurb: "Alert work" },
  { label: "Gamma", beat: 40, base: 300, blurb: "Intense focus" },
];

export const NoiseGeneratorPanel: React.FC = () => {
  const {
    isNoiseActive,
    noiseColor,
    noiseVolume,
    noiseTone,
    toggleNoise,
    setNoiseColor,
    setNoiseVolume,
    setNoiseTone,
    isBinauralActive,
    binauralBaseFreq,
    binauralBeatFreq,
    binauralVolume,
    toggleBinaural,
    setBinauralParams,
  } = useAudioStore();

  return (
    <Panel
      title="Focus Engine"
      subtitle="The 730BT has no ANC — masking noise is the substitute"
      icon={<CloudRain size={15} />}
      bodyClassName="grid gap-4 lg:grid-cols-2"
    >
      {/* ---- Noise bed ---- */}
      <div className="at-inset space-y-3.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[12px] font-semibold text-ink">Masking noise</h3>
            <p className="mt-0.5 text-[11px] text-faint">Synthesised live — no samples, no loops to notice</p>
          </div>
          <Button
            variant={isNoiseActive ? "primary" : "outline"}
            onClick={toggleNoise}
          >
            <Power size={13} />
            {isNoiseActive ? "On" : "Off"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {NOISE_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => setNoiseColor(color.id as NoiseColor)}
              title={color.blurb}
              className={cn(
                "at-focus rounded-lg border px-2 py-2 text-left transition-colors",
                noiseColor === color.id
                  ? "border-accent/50 bg-accent/10"
                  : "border-line-soft bg-white/[0.02] hover:border-line"
              )}
            >
              <span
                className={cn(
                  "block text-[11px] font-medium",
                  noiseColor === color.id ? "text-accent" : "text-dim"
                )}
              >
                {color.label}
              </span>
            </button>
          ))}
        </div>

        <p className="text-[11px] leading-snug text-faint">
          {NOISE_COLORS.find((c) => c.id === noiseColor)?.blurb}
        </p>

        <Slider
          label="Level"
          value={noiseVolume}
          min={0}
          max={0.6}
          step={0.005}
          onChange={setNoiseVolume}
          format={(v) => `${Math.round((v / 0.6) * 100)}%`}
        />

        <Slider
          label="Tone"
          value={noiseTone}
          min={200}
          max={20000}
          step={100}
          onChange={setNoiseTone}
          format={(v) => (v >= 19900 ? "Full range" : `${(v / 1000).toFixed(1)} kHz lowpass`)}
        />
      </div>

      {/* ---- Binaural ---- */}
      <div className="at-inset space-y-3.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[12px] font-semibold text-ink">Binaural carrier</h3>
            <p className="mt-0.5 text-[11px] text-faint">
              Needs headphones — the effect comes from the difference between ears
            </p>
          </div>
          <Button
            variant={isBinauralActive ? "primary" : "outline"}
            onClick={toggleBinaural}
          >
            <Brain size={13} />
            {isBinauralActive ? `${binauralBeatFreq} Hz` : "Off"}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {BRAINWAVE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setBinauralParams(preset.base, preset.beat, binauralVolume)}
              className={cn(
                "at-focus rounded-lg border px-1.5 py-2 text-center transition-colors",
                binauralBeatFreq === preset.beat
                  ? "border-accent2/50 bg-accent2/10"
                  : "border-line-soft bg-white/[0.02] hover:border-line"
              )}
            >
              <span
                className={cn(
                  "block text-[11px] font-medium",
                  binauralBeatFreq === preset.beat ? "text-accent2" : "text-dim"
                )}
              >
                {preset.label}
              </span>
              <span className="at-mono mt-0.5 block text-[9px] text-faint">{preset.beat} Hz</span>
            </button>
          ))}
        </div>

        <Slider
          label="Carrier frequency"
          value={binauralBaseFreq}
          min={60}
          max={500}
          step={1}
          onChange={(v) => setBinauralParams(v, binauralBeatFreq, binauralVolume)}
          format={(v) => `${v} Hz`}
        />
        <Slider
          label="Beat frequency"
          value={binauralBeatFreq}
          min={1}
          max={40}
          step={0.5}
          onChange={(v) => setBinauralParams(binauralBaseFreq, v, binauralVolume)}
          format={(v) => `${v} Hz`}
        />
        <Slider
          label="Level"
          value={binauralVolume}
          min={0}
          max={0.4}
          step={0.005}
          onChange={(v) => setBinauralParams(binauralBaseFreq, binauralBeatFreq, v)}
          format={(v) => `${Math.round((v / 0.4) * 100)}%`}
        />

        <p className="text-[11px] leading-relaxed text-faint">
          {BRAINWAVE_PRESETS.find((p) => p.beat === binauralBeatFreq)?.blurb ??
            "Custom beat frequency"}
          . Keep the level low; this is meant to sit under your music, not replace it.
        </p>
      </div>
    </Panel>
  );
};
