"use client";

import React from "react";
import { Header } from "@/components/Header";
import { EqualizerPanel } from "@/components/EqualizerPanel";
import { VisualizerPanel } from "@/components/VisualizerPanel";
import { NoiseGeneratorPanel } from "@/components/NoiseGeneratorPanel";
import { BluetoothPanel } from "@/components/BluetoothPanel";
import { PresetMarketplacePanel } from "@/components/PresetMarketplacePanel";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-zinc-100 selection:bg-zinc-800 selection:text-white">
      {/* Studio Header */}
      <Header />

      {/* Main Studio Dashboard Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Equalizer & Visualizer Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8">
            <EqualizerPanel />
          </div>
          <div className="lg:col-span-4 space-y-8">
            <VisualizerPanel />
            <NoiseGeneratorPanel />
          </div>
        </div>

        {/* Telemetry & Preset Marketplace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5">
            <BluetoothPanel />
          </div>
          <div className="lg:col-span-7">
            <PresetMarketplacePanel />
          </div>
        </div>
      </main>

      {/* Minimalist Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#090a0f] py-6 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 font-mono gap-4">
          <div>
            AuraTune DSP Studio • Next.js & Ruby on Rails Engine
          </div>
          <div>
            60FPS Web Audio Engine
          </div>
        </div>
      </footer>
    </div>
  );
}
