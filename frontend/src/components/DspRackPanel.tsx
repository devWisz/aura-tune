"use client";

import React, { useEffect, useState } from "react";
import { Flame, Gauge, Headphones, Waves } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { audioEngine, ReverbPreset } from "@/lib/audio/audioEngine";
import { Panel, Segmented, Slider, Toggle } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

const REVERB_OPTIONS: { id: ReverbPreset; label: string }[] = [
  { id: "none", label: "Dry" },
  { id: "room", label: "Room" },
  { id: "hall", label: "Hall" },
  { id: "cathedral", label: "Cathedral" },
];

const Rack: React.FC<{
  title: string;
  icon: React.ReactNode;
  blurb: string;
  children: React.ReactNode;
}> = ({ title, icon, blurb, children }) => (
  <div className="at-inset space-y-3 p-3.5">
    <div className="flex items-start gap-2">
      <span className="mt-[1px] text-accent">{icon}</span>
      <div>
        <h3 className="text-[12px] font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-faint">{blurb}</p>
      </div>
    </div>
    {children}
  </div>
);

/** Live gain-reduction readout for the compressor. */
const ReductionMeter: React.FC<{ active: boolean }> = ({ active }) => {
  const [reduction, setReduction] = useState(0);

  useEffect(() => {
    if (!active) {
      setReduction(0);
      return;
    }
    const id = window.setInterval(() => {
      setReduction(audioEngine.getCompressorReduction());
    }, 80);
    return () => window.clearInterval(id);
  }, [active]);

  const depth = Math.min(1, Math.abs(reduction) / 20);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="at-label">Gain reduction</span>
        <span className="at-mono text-[11px] text-dim">{reduction.toFixed(1)} dB</span>
      </div>
      <div className="h-[6px] overflow-hidden rounded-full bg-sunken ring-1 ring-inset ring-line-soft">
        <div
          className={cn("h-full rounded-full transition-[width] duration-100", active ? "bg-warm" : "bg-line")}
          style={{ width: `${depth * 100}%` }}
        />
      </div>
    </div>
  );
};

export const DspRackPanel: React.FC = () => {
  const { dsp, setDsp } = useAudioStore();

  return (
    <Panel
      title="Signal Chain"
      subtitle="Everything between the equaliser and the 730BT drivers"
      icon={<Gauge size={15} />}
      bodyClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
    >
      {/* --- Crossfeed & balance --- */}
      <Rack
        title="Headphone Imaging"
        icon={<Headphones size={14} />}
        blurb="Speakers let each ear hear both channels. Crossfeed restores that, which removes the 'sound trapped inside your head' effect on hard-panned mixes."
      >
        <Slider
          label="Crossfeed"
          value={dsp.crossfeed}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setDsp("crossfeed", v)}
          format={(v) => (v === 0 ? "Off" : `${Math.round(v * 100)}%`)}
        />
        <Slider
          label="Channel balance"
          value={dsp.balance}
          min={-1}
          max={1}
          step={0.01}
          onChange={(v) => setDsp("balance", v)}
          format={(v) =>
            Math.abs(v) < 0.01
              ? "Centred"
              : `${v < 0 ? "L" : "R"} +${Math.round(Math.abs(v) * 100)}%`
          }
        />
      </Rack>

      {/* --- Saturator --- */}
      <Rack
        title="Tube Saturator"
        icon={<Flame size={14} />}
        blurb="An AudioWorklet valve stage. Adds even-order harmonics and softens transients — a little goes a long way."
      >
        <Slider
          label="Drive"
          value={dsp.saturation}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setDsp("saturation", v)}
          format={(v) => (v === 0 ? "Bypassed" : `${Math.round(v * 100)}%`)}
        />
        <Slider
          label="Warmth"
          value={dsp.warmth}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setDsp("warmth", v)}
          format={(v) => `${Math.round(v * 100)}%`}
          disabled={dsp.saturation === 0}
        />
      </Rack>

      {/* --- Dynamics --- */}
      <Rack
        title="Dynamics"
        icon={<Gauge size={14} />}
        blurb="Compression evens out volume swings; the limiter is a final safety net against clipping."
      >
        <Toggle
          checked={dsp.compressorOn}
          onChange={(v) => setDsp("compressorOn", v)}
          label="Compressor"
          hint="Tames loud peaks so quiet detail stays audible"
        />
        <Slider
          label="Threshold"
          value={dsp.compThreshold}
          min={-60}
          max={0}
          step={1}
          onChange={(v) => setDsp("compThreshold", v)}
          format={(v) => `${v} dB`}
          disabled={!dsp.compressorOn}
        />
        <Slider
          label="Ratio"
          value={dsp.compRatio}
          min={1}
          max={20}
          step={0.5}
          onChange={(v) => setDsp("compRatio", v)}
          format={(v) => `${v}:1`}
          disabled={!dsp.compressorOn}
        />
        <ReductionMeter active={dsp.compressorOn} />
        <Toggle
          checked={dsp.limiterOn}
          onChange={(v) => setDsp("limiterOn", v)}
          label="Output limiter"
          hint="Recommended — catches clipping from large EQ boosts"
        />
      </Rack>

      {/* --- Space --- */}
      <Rack
        title="Space"
        icon={<Waves size={14} />}
        blurb="Convolution reverb with synthesised impulse responses, mixed against the dry signal."
      >
        <div className="space-y-1.5">
          <span className="at-label">Environment</span>
          <Segmented
            size="xs"
            value={dsp.reverbPreset}
            options={REVERB_OPTIONS}
            onChange={(id) => setDsp("reverbPreset", id)}
            className="w-full justify-between"
          />
        </div>
        <Slider
          label="Mix"
          value={dsp.reverbAmount}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setDsp("reverbAmount", v)}
          format={(v) => `${Math.round(v * 100)}% wet`}
          disabled={dsp.reverbPreset === "none"}
        />
      </Rack>
    </Panel>
  );
};
