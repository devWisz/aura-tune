"use client";

import React from "react";
import {
  Activity,
  AudioWaveform,
  Headphones,
  Keyboard,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { Button, Chip, Slider } from "@/components/ui/Primitives";

export const Header: React.FC<{ onShowShortcuts: () => void }> = ({ onShowShortcuts }) => {
  const {
    masterVolume,
    setMasterVolume,
    muted,
    toggleMute,
    engineStatus,
    refreshEngineStatus,
    primaryConnected,
    bluetoothBattery,
    bluetoothBatterySupported,
  } = useAudioStore();

  // The context's sample rate and latency are only known after it starts, so
  // poll lightly rather than leaving the header showing "standby" forever.
  React.useEffect(() => {
    refreshEngineStatus();
    const id = window.setInterval(refreshEngineStatus, 2000);
    return () => window.clearInterval(id);
  }, [refreshEngineStatus]);

  const VolumeIcon = muted || masterVolume === 0 ? VolumeX : masterVolume < 0.5 ? Volume1 : Volume2;

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-2.5 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent ring-1 ring-inset ring-accent/30">
            <AudioWaveform size={15} />
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-ink">AuraTune</div>
            <div className="at-label">Tune 730BT Studio</div>
          </div>
        </div>

        {/* Headphone state — the one status the whole app is built around. */}
        <Chip tone={primaryConnected ? "ok" : "neutral"} pulse={primaryConnected}>
          <Headphones size={10} />
          <span className="hidden sm:inline">
            {primaryConnected ? "730BT connected" : "730BT not detected"}
          </span>
          {bluetoothBatterySupported && bluetoothBattery !== null && (
            <span className="text-current">· {bluetoothBattery}%</span>
          )}
        </Chip>

        {/* Engine telemetry */}
        <div className="hidden items-center gap-1.5 md:flex">
          {engineStatus.ready ? (
            <>
              <Chip tone={engineStatus.state === "running" ? "ok" : "neutral"} pulse={engineStatus.state === "running"}>
                {engineStatus.state === "running" ? "Engine live" : engineStatus.state}
              </Chip>
              <Chip>{(engineStatus.sampleRate / 1000).toFixed(1)} kHz</Chip>
              {engineStatus.latencyMs > 0 && <Chip>{engineStatus.latencyMs} ms</Chip>}
              <Chip tone={engineStatus.worklet === "active" ? "accent" : "neutral"}>
                {engineStatus.worklet === "active" ? "Worklet" : "No worklet"}
              </Chip>
            </>
          ) : (
            <Chip>
              <Activity size={10} /> Standby
            </Chip>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={onShowShortcuts} aria-label="Keyboard shortcuts" className="px-2">
            <Keyboard size={14} />
          </Button>

          {/* Master volume */}
          <div className="flex items-center gap-2 rounded-lg border border-line-soft bg-white/[0.02] px-2.5 py-1.5">
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="at-focus rounded text-faint transition-colors hover:text-ink"
            >
              <VolumeIcon size={15} />
            </button>
            <Slider
              value={muted ? 0 : masterVolume}
              min={0}
              max={1}
              step={0.01}
              onChange={setMasterVolume}
              className="w-20 sm:w-28"
              accentOff={muted}
            />
            <span className="at-mono w-8 text-right text-[11px] text-dim">
              {Math.round((muted ? 0 : masterVolume) * 100)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
