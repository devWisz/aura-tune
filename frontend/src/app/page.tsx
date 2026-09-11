"use client";

import React, { useEffect, useState } from "react";
import { Ear, Gauge, Library, ListMusic, Waves } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { Header } from "@/components/Header";
import { TransportBar } from "@/components/TransportBar";
import { EqualizerPanel } from "@/components/EqualizerPanel";
import { VisualizerPanel } from "@/components/VisualizerPanel";
import { DevicePanel } from "@/components/DevicePanel";
import { DspRackPanel } from "@/components/DspRackPanel";
import { NoiseGeneratorPanel } from "@/components/NoiseGeneratorPanel";
import { PresetMarketplacePanel } from "@/components/PresetMarketplacePanel";
import { PlaylistPanel } from "@/components/PlaylistPanel";
import { HearingTestPanel } from "@/components/HearingTestPanel";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { ToastHost } from "@/components/ui/ToastHost";
import { cn } from "@/lib/cn";

type TabId = "chain" | "focus" | "presets" | "hearing" | "queue";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "chain", label: "Signal chain", icon: Gauge },
  { id: "presets", label: "Presets", icon: Library },
  { id: "focus", label: "Focus engine", icon: Waves },
  { id: "hearing", label: "Hearing profile", icon: Ear },
  { id: "queue", label: "Queue", icon: ListMusic },
];

export default function Home() {
  const hydrate = useAudioStore((s) => s.hydrate);
  const hydrated = useAudioStore((s) => s.hydrated);
  const [tab, setTab] = useState<TabId>("chain");
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Settings live in localStorage, which only exists on the client — hydrating
  // here rather than in the store's initialiser keeps SSR output stable.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Header onShowShortcuts={() => setShowShortcuts(true)} />

      <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        <TransportBar />

        {/* Primary workspace: the analyser and the output routing sit together
            above the fold, because they answer "is it working?" and "where is
            the sound going?" — the two questions users ask first. */}
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7 xl:col-span-8">
            <VisualizerPanel />
          </div>
          <div className="lg:col-span-5 xl:col-span-4">
            <DevicePanel />
          </div>
        </div>

        {/* The equaliser gets the full width — ten faders and a response curve
            were badly cramped in a two-thirds column. */}
        <EqualizerPanel />

        {/* Everything secondary is tabbed rather than stacked, so the page stays
            one screen tall instead of five. */}
        <section>
          <div
            role="tablist"
            aria-label="Studio sections"
            className="no-scrollbar mb-3 flex gap-1 overflow-x-auto"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "at-focus flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors",
                  tab === id
                    ? "border-accent/45 bg-accent/10 text-accent"
                    : "border-line-soft bg-white/[0.02] text-faint hover:border-line hover:text-dim"
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          <div key={tab} className="animate-fade-up">
            {tab === "chain" && <DspRackPanel />}
            {tab === "presets" && <PresetMarketplacePanel />}
            {tab === "focus" && <NoiseGeneratorPanel />}
            {tab === "hearing" && <HearingTestPanel />}
            {tab === "queue" && <PlaylistPanel />}
          </div>
        </section>
      </main>

      <footer className="border-t border-line-soft/70 px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-2 text-[11px] text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>
            AuraTune — tuned for the JBL Tune 730BT. Everything runs locally in your browser;
            audio files never leave your device.
          </span>
          <span className="at-mono">
            {hydrated ? "Settings restored from this device" : "Loading settings…"}
          </span>
        </div>
      </footer>

      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <ToastHost />
    </div>
  );
}
