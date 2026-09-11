"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, Library, Plus, Trash2, Upload } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { EQ_FREQUENCIES } from "@/lib/audio/biquadFilterBank";
import { Button, Panel } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

/** Tiny inline sparkline of a preset's EQ shape. */
const CurveGlyph: React.FC<{ gains: number[]; active: boolean }> = ({ gains, active }) => {
  const width = 88;
  const height = 24;
  const points = gains
    .map((gain, i) => {
      const x = (i / (gains.length - 1)) * width;
      const y = height / 2 - (Math.max(-18, Math.min(18, gain)) / 18) * (height / 2 - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <line
        x1="0"
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke="currentColor"
        strokeOpacity="0.14"
        strokeWidth="1"
      />
      <polyline
        points={points}
        fill="none"
        stroke={active ? "rgb(56,208,255)" : "currentColor"}
        strokeOpacity={active ? 1 : 0.45}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const PresetMarketplacePanel: React.FC = () => {
  const {
    communityPresets,
    fetchCommunityPresets,
    applyPreset,
    activePresetId,
    saveCustomPreset,
    deletePreset,
    exportPreset,
    importPreset,
    eqGains,
    dsp,
    hydrated,
  } = useAudioStore();

  const importRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (hydrated) void fetchCommunityPresets();
  }, [hydrated, fetchCommunityPresets]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    void saveCustomPreset({
      name: name.trim(),
      description: description.trim() || "Custom tuning saved from the studio.",
      headphoneModel: model.trim() || "Any",
      eqGains: [...eqGains],
      reverbPreset: dsp.reverbPreset,
      author: "You",
    });

    setName("");
    setModel("");
    setDescription("");
    setShowForm(false);
  };

  const inputClass =
    "at-focus w-full rounded-lg border border-line-soft bg-sunken px-3 py-2 text-[12px] text-ink placeholder:text-faint";

  return (
    <Panel
      title="Preset Library"
      subtitle={`${communityPresets.length} tunings · saved on this device, synced when the API is reachable`}
      icon={<Library size={15} />}
      actions={
        <>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) importPreset(await file.text());
              e.target.value = "";
            }}
          />
          <Button variant="ghost" onClick={() => importRef.current?.click()} title="Import a preset file">
            <Upload size={13} />
          </Button>
          <Button variant="ghost" onClick={exportPreset} title="Export the current tuning">
            <Download size={13} />
          </Button>
          <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
            <Plus size={13} /> Save current
          </Button>
        </>
      }
      bodyClassName="space-y-4"
    >
      {showForm && (
        <form onSubmit={handleSubmit} className="at-inset animate-fade-up space-y-2.5 p-4">
          <p className="at-label">Save the current {EQ_FREQUENCIES.length}-band curve</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              className={inputClass}
              placeholder="Preset name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <input
              className={inputClass}
              placeholder="Headphone model (optional)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
          <input
            className={inputClass}
            placeholder="What does it sound like?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save preset
            </Button>
          </div>
        </form>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {communityPresets.map((preset) => {
          const isActive = activePresetId === preset.id;

          return (
            <div
              key={preset.id}
              className={cn(
                "group flex flex-col gap-2.5 rounded-lg border p-3.5 transition-colors",
                isActive
                  ? "border-accent/45 bg-accent/[0.06]"
                  : "border-line-soft bg-white/[0.02] hover:border-line"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3
                    className={cn(
                      "truncate text-[12px] font-semibold",
                      isActive ? "text-accent" : "text-ink"
                    )}
                  >
                    {preset.name}
                  </h3>
                  <p className="at-mono mt-0.5 truncate text-[10px] text-faint">
                    {preset.headphoneModel} · {preset.author}
                  </p>
                </div>
                <div className="text-dim">
                  <CurveGlyph gains={preset.eqGains} active={isActive} />
                </div>
              </div>

              <p className="line-clamp-2 text-[11px] leading-snug text-faint">{preset.description}</p>

              <div className="mt-auto flex items-center gap-1.5">
                <Button
                  variant={isActive ? "primary" : "outline"}
                  className="flex-1"
                  onClick={() => applyPreset(preset)}
                >
                  {isActive ? "Loaded" : "Load"}
                </Button>
                {preset.local && (
                  <Button
                    variant="ghost"
                    onClick={() => deletePreset(preset.id)}
                    aria-label={`Delete ${preset.name}`}
                    className="px-2 text-faint hover:text-danger"
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};
