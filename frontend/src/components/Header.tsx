"use client";

import React, { useRef } from "react";
import { useAudioStore } from "@/store/useAudioStore";
import { audioEngine } from "@/lib/audio/audioEngine";

export const Header: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    masterVolume,
    setMasterVolume,
    isPlaying,
    setIsPlaying,
    isMicActive,
    toggleMic,
    bluetoothConnected,
    bluetoothDeviceName,
    bluetoothBattery,
    connectBluetooth,
  } = useAudioStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && audioRef.current) {
      const url = URL.createObjectURL(file);
      audioRef.current.src = url;
      audioEngine.connectAudioElement(audioRef.current);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioEngine.init();
        if (audioRef.current.src) {
          audioRef.current.play();
          setIsPlaying(true);
        } else {
          fileInputRef.current?.click();
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <header className="border-b border-zinc-800/80 bg-[#090a0f] px-6 py-4">
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*"
        className="hidden"
      />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Clean Typography Brand */}
        <div className="flex items-center space-x-3">
          <div className="text-sm font-semibold tracking-wider text-white uppercase">
            AuraTune <span className="text-zinc-500 font-mono text-xs ml-1">/ DSP Studio</span>
          </div>
        </div>

        {/* Media & Input Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={togglePlayPause}
            className="px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-black font-medium text-xs transition"
          >
            {isPlaying ? "Pause Audio" : "Load Audio File"}
          </button>

          <button
            onClick={toggleMic}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              isMicActive
                ? "bg-zinc-100 text-black border-white"
                : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {isMicActive ? "Mic Active" : "Microphone Input"}
          </button>
        </div>

        {/* Master Volume & Bluetooth Pairing */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-zinc-900/60 px-3 py-1.5 rounded-lg border border-zinc-800">
            <span className="text-xs text-zinc-400 font-mono">VOL</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-zinc-700 rounded appearance-none cursor-pointer accent-white"
            />
            <span className="text-xs font-mono text-zinc-300 w-8 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>

          <button
            onClick={connectBluetooth}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              bluetoothConnected
                ? "bg-zinc-900 text-zinc-100 border-zinc-700"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            {bluetoothConnected ? bluetoothDeviceName : "Pair Bluetooth"}
            {bluetoothBattery !== null && (
              <span className="ml-1.5 text-zinc-400 font-mono text-[11px]">
                [{bluetoothBattery}%]
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
