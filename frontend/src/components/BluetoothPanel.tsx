"use client";

import React from "react";
import { useAudioStore } from "@/store/useAudioStore";

export const BluetoothPanel: React.FC = () => {
  const {
    bluetoothConnected,
    bluetoothDeviceName,
    bluetoothBattery,
    connectBluetooth,
    disconnectBluetooth,
  } = useAudioStore();

  return (
    <div className="bg-[#10121a] rounded-xl border border-zinc-800/80 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <h2 className="text-sm font-semibold tracking-wider text-white uppercase">
          Hardware & Telemetry
        </h2>

        {bluetoothConnected ? (
          <button
            onClick={disconnectBluetooth}
            className="text-xs text-zinc-400 hover:text-white transition font-mono"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={connectBluetooth}
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-black text-xs font-medium transition"
          >
            Pair Headphone
          </button>
        )}
      </div>

      {bluetoothConnected ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#090a0f] p-4 rounded-lg border border-zinc-800/60">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Device</div>
            <div className="text-sm font-semibold text-white mt-1">{bluetoothDeviceName}</div>
            <div className="text-[10px] font-mono text-zinc-400 mt-0.5">Web Bluetooth Active</div>
          </div>

          <div className="bg-[#090a0f] p-4 rounded-lg border border-zinc-800/60">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Battery</div>
            <div className="text-sm font-semibold text-white mt-1">{bluetoothBattery ?? "--"}%</div>
            <div className="w-full h-1 bg-zinc-800 rounded mt-2 overflow-hidden">
              <div
                className="h-full bg-white rounded"
                style={{ width: `${bluetoothBattery ?? 0}%` }}
              />
            </div>
          </div>

          <div className="bg-[#090a0f] p-4 rounded-lg border border-zinc-800/60">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Hardware Profile</div>
            <div className="text-sm font-semibold text-white mt-1">Active NC Profile</div>
            <div className="text-[10px] font-mono text-zinc-400 mt-0.5">Media Session Synced</div>
          </div>
        </div>
      ) : (
        <div className="bg-[#090a0f] p-6 rounded-lg border border-zinc-800/60 text-center space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">No Peripheral Paired</div>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Connect your JBL Tune or Bluetooth audio device via Web Bluetooth (`navigator.bluetooth`) for real-time telemetry.
          </p>
        </div>
      )}
    </div>
  );
};
