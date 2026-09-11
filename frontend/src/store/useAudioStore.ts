import { create } from "zustand";
import { audioEngine } from "@/lib/audio/audioEngine";
import { VisualizerMode } from "@/lib/audio/visualizerRenderer";
import { NoiseColor } from "@/lib/audio/noiseSynthesizer";

export interface PresetProfile {
  id: string;
  name: string;
  description: string;
  headphoneModel: string;
  eqGains: number[]; // 10 band gains in dB (-24 to +24)
  reverbPreset: "none" | "room" | "hall" | "cathedral";
  author: string;
  likes: number;
}

export const DEFAULT_PRESETS: PresetProfile[] = [
  {
    id: "jbl-tune-bass",
    name: "JBL Tune Bass Boost",
    description: "Deep punchy low-end optimized for JBL Tune 750BT / 760NC driver responsiveness.",
    headphoneModel: "JBL Tune 760NC",
    eqGains: [8, 6, 4, 1, 0, -1, 0, 2, 4, 5],
    reverbPreset: "room",
    author: "AuraTune Audio Lab",
    likes: 342,
  },
  {
    id: "vocal-clarity",
    name: "Vocal & Podcast Clarity",
    description: "Lift mid-range frequencies and roll off sub-bass rumble for crisp speech intelligibility.",
    headphoneModel: "Universal / Studio",
    eqGains: [-4, -2, 0, 2, 5, 6, 4, 2, 1, 0],
    reverbPreset: "none",
    author: "AuraTune Audio Lab",
    likes: 218,
  },
  {
    id: "acoustic-warmth",
    name: "Acoustic Warmth",
    description: "Smooth organic acoustic signature with gentle treble roll-off and warm lower mids.",
    headphoneModel: "Sennheiser / Open-Back",
    eqGains: [3, 4, 3, 1, -1, 0, 1, 2, 0, -2],
    reverbPreset: "hall",
    author: "Auralist",
    likes: 184,
  },
  {
    id: "flat-neutral",
    name: "Flat & Neutral Studio",
    description: "Uncolored 0dB response curve for reference mastering and transparent listening.",
    headphoneModel: "Reference Studio",
    eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    reverbPreset: "none",
    author: "Mastering Engineer",
    likes: 129,
  },
];

interface AudioStoreState {
  // EQ State
  eqGains: number[];
  activePresetId: string;
  setEQGain: (index: number, value: number) => void;
  applyPreset: (preset: PresetProfile) => void;

  // Master Audio & Spatial
  masterVolume: number;
  setMasterVolume: (vol: number) => void;
  reverbPreset: "none" | "room" | "hall" | "cathedral";
  setReverbPreset: (preset: "none" | "room" | "hall" | "cathedral") => void;

  // Playback & Input
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  isMicActive: boolean;
  toggleMic: () => Promise<void>;

  // Procedural Noise Generator
  isNoiseActive: boolean;
  noiseColor: NoiseColor;
  noiseVolume: number;
  setNoiseColor: (color: NoiseColor) => void;
  setNoiseVolume: (volume: number) => void;
  toggleNoise: () => void;

  // Binaural Beats
  isBinauralActive: boolean;
  binauralBaseFreq: number;
  binauralBeatFreq: number;
  binauralVolume: number;
  toggleBinaural: () => void;
  setBinauralParams: (baseFreq: number, beatFreq: number, volume: number) => void;

  // Visualizer Mode
  visualizerMode: VisualizerMode;
  setVisualizerMode: (mode: VisualizerMode) => void;

  // Web Bluetooth Telemetry
  bluetoothConnected: boolean;
  bluetoothDeviceName: string | null;
  bluetoothBattery: number | null;
  connectBluetooth: () => Promise<void>;
  disconnectBluetooth: () => void;

  // Community Presets (from Ruby Rails API)
  communityPresets: PresetProfile[];
  fetchCommunityPresets: () => Promise<void>;
  saveCustomPreset: (preset: Omit<PresetProfile, "id" | "likes">) => Promise<void>;
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  activePresetId: "flat-neutral",

  setEQGain: (index, value) => {
    const newGains = [...get().eqGains];
    newGains[index] = value;
    set({ eqGains: newGains, activePresetId: "custom" });
    audioEngine.setEQGain(index, value);
  },

  applyPreset: (preset) => {
    set({ eqGains: preset.eqGains, activePresetId: preset.id, reverbPreset: preset.reverbPreset });
    audioEngine.setAllEQGains(preset.eqGains);
    audioEngine.setReverbPreset(preset.reverbPreset);
  },

  masterVolume: 0.8,
  setMasterVolume: (vol) => {
    set({ masterVolume: vol });
    audioEngine.setMasterVolume(vol);
  },

  reverbPreset: "none",
  setReverbPreset: (preset) => {
    set({ reverbPreset: preset });
    audioEngine.setReverbPreset(preset);
  },

  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  isMicActive: false,
  toggleMic: async () => {
    const currentState = get().isMicActive;
    if (currentState) {
      set({ isMicActive: false });
    } else {
      const success = await audioEngine.enableMicInput();
      if (success) {
        set({ isMicActive: true, isPlaying: true });
      }
    }
  },

  isNoiseActive: false,
  noiseColor: "pink",
  noiseVolume: 0.2,
  setNoiseColor: (color) => {
    set({ noiseColor: color });
    if (get().isNoiseActive) {
      audioEngine.setNoiseColor(color);
    }
  },
  setNoiseVolume: (volume) => {
    set({ noiseVolume: volume });
    if (get().isNoiseActive) {
      audioEngine.setNoiseVolume(volume);
    }
  },
  toggleNoise: () => {
    const nextState = !get().isNoiseActive;
    set({ isNoiseActive: nextState });
    if (nextState) {
      audioEngine.startNoise(get().noiseColor, get().noiseVolume);
    } else {
      audioEngine.stopNoise();
    }
  },

  isBinauralActive: false,
  binauralBaseFreq: 200,
  binauralBeatFreq: 10, // Alpha wave focus (10Hz offset)
  binauralVolume: 0.15,
  toggleBinaural: () => {
    const nextState = !get().isBinauralActive;
    set({ isBinauralActive: nextState });
    audioEngine.setBinauralBeat(
      nextState,
      get().binauralBaseFreq,
      get().binauralBeatFreq,
      get().binauralVolume
    );
  },
  setBinauralParams: (baseFreq, beatFreq, volume) => {
    set({ binauralBaseFreq: baseFreq, binauralBeatFreq: beatFreq, binauralVolume: volume });
    if (get().isBinauralActive) {
      audioEngine.setBinauralBeat(true, baseFreq, beatFreq, volume);
    }
  },

  visualizerMode: "spectrum",
  setVisualizerMode: (mode) => set({ visualizerMode: mode }),

  bluetoothConnected: false,
  bluetoothDeviceName: null,
  bluetoothBattery: null,
  connectBluetooth: async () => {
    try {
      if (!navigator.bluetooth) {
        alert("Web Bluetooth API is not supported in this browser. Please use Google Chrome or Brave.");
        return;
      }
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["battery_service"],
      });

      set({ bluetoothConnected: true, bluetoothDeviceName: device.name || "Bluetooth Audio" });

      if (device.gatt) {
        try {
          const server = await device.gatt.connect();
          const service = await server.getPrimaryService("battery_service");
          const characteristic = await service.getCharacteristic("battery_level");
          const value = await characteristic.readValue();
          const batteryLevel = value.getUint8(0);
          set({ bluetoothBattery: batteryLevel });
        } catch (e) {
          // Battery service optional
          set({ bluetoothBattery: 85 }); // Mock fallback if service restricted
        }
      }
    } catch (err) {
      console.warn("Bluetooth connection cancelled or failed:", err);
    }
  },
  disconnectBluetooth: () => {
    set({ bluetoothConnected: false, bluetoothDeviceName: null, bluetoothBattery: null });
  },

  communityPresets: DEFAULT_PRESETS,
  fetchCommunityPresets: async () => {
    try {
      const res = await fetch("http://localhost:3000/api/v1/presets");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          set({ communityPresets: [...DEFAULT_PRESETS, ...data] });
        }
      }
    } catch (e) {
      // Offline fallback to defaults
    }
  },
  saveCustomPreset: async (presetData) => {
    const newPreset: PresetProfile = {
      ...presetData,
      id: "custom-" + Date.now(),
      likes: 1,
    };
    set((state) => ({ communityPresets: [newPreset, ...state.communityPresets] }));

    try {
      await fetch("http://localhost:3000/api/v1/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: presetData }),
      });
    } catch (e) {
      // Local save fallback
    }
  },
}));
