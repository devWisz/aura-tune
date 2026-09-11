"use client";

import React, { useEffect, useState } from "react";
import { useAudioStore } from "@/store/useAudioStore";

export const PresetMarketplacePanel: React.FC = () => {
  const { communityPresets, fetchCommunityPresets, applyPreset, activePresetId, saveCustomPreset, eqGains, reverbPreset } = useAudioStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newHeadphoneModel, setNewHeadphoneModel] = useState("JBL Tune 760NC");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    fetchCommunityPresets();
  }, [fetchCommunityPresets]);

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName) return;

    saveCustomPreset({
      name: newPresetName,
      description: newDescription || "Custom user tuned profile",
      headphoneModel: newHeadphoneModel,
      eqGains: [...eqGains],
      reverbPreset: reverbPreset,
      author: "Studio User",
    });

    setNewPresetName("");
    setNewDescription("");
    setShowAddModal(false);
  };

  return (
    <div className="bg-[#10121a] rounded-xl border border-zinc-800/80 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-white uppercase">
            Cloud Preset Marketplace
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Powered by Ruby on Rails Cloud Engine</p>
        </div>

        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-black text-xs font-medium transition"
        >
          Save EQ to Cloud
        </button>
      </div>

      {/* Add Modal Form */}
      {showAddModal && (
        <form onSubmit={handleCreatePreset} className="bg-[#090a0f] p-4 rounded-lg border border-zinc-800 space-y-3">
          <div className="text-xs font-semibold text-white uppercase tracking-wider">Save Custom Preset</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Preset Name (e.g. JBL Heavy Bass)"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
              required
            />
            <input
              type="text"
              placeholder="Headphone Model (e.g. JBL Tune 760NC)"
              value={newHeadphoneModel}
              onChange={(e) => setNewHeadphoneModel(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <input
            type="text"
            placeholder="Short profile description..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-zinc-100 hover:bg-white text-black text-xs font-medium"
            >
              Upload to Ruby API
            </button>
          </div>
        </form>
      )}

      {/* Preset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {communityPresets.map((preset) => (
          <div
            key={preset.id}
            className={`p-4 rounded-lg border transition space-y-3 ${
              activePresetId === preset.id
                ? "bg-[#090a0f] border-zinc-500"
                : "bg-[#090a0f] border-zinc-800/60 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  {preset.name}
                  {activePresetId === preset.id && (
                    <span className="text-[9px] font-mono uppercase bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded border border-zinc-700">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{preset.description}</p>
              </div>

              <div className="text-xs text-zinc-400 font-mono bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                {preset.likes} likes
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-2 border-t border-zinc-800/60">
              <span>{preset.headphoneModel}</span>
              <span>by {preset.author}</span>
            </div>

            <button
              onClick={() => applyPreset(preset)}
              className="w-full py-1.5 rounded bg-zinc-900 hover:bg-zinc-100 hover:text-black text-zinc-300 border border-zinc-800 text-xs font-medium transition"
            >
              Audition & Load Preset
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
