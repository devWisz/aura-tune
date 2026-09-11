import { create } from "zustand";
import { audioEngine, ReverbPreset, EngineStatus } from "@/lib/audio/audioEngine";
import { VisualizerMode } from "@/lib/audio/visualizerRenderer";
import { NoiseColor } from "@/lib/audio/noiseSynthesizer";
import { EQ_FREQUENCIES } from "@/lib/audio/biquadFilterBank";
import {
  AudioOutputDevice,
  BluetoothLinkError,
  DeviceSupport,
  getDeviceSupport,
  listOutputDevices,
  requestDeviceLabels,
  pickOutputDevice,
  connectBluetoothTelemetry,
  BluetoothSession,
} from "@/lib/audio/deviceManager";
import {
  HeadphoneProfile,
  matchHeadphoneProfile,
  isPrimaryHeadphone,
  PRIMARY_PROFILE,
} from "@/lib/audio/headphoneProfiles";
import { Audiogram, audiogramToBalance, audiogramToEQGains } from "@/lib/audio/hearingTest";
import { loadState, saveState, debounceSave } from "@/lib/persist";
import { toast } from "./useToastStore";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";
const FLAT: number[] = new Array(EQ_FREQUENCIES.length).fill(0);
const persist = debounceSave();

export interface PresetProfile {
  id: string;
  name: string;
  description: string;
  headphoneModel: string;
  eqGains: number[];
  reverbPreset: ReverbPreset;
  author: string;
  likes: number;
  /** Present on presets the user made locally, so they can be deleted. */
  local?: boolean;
}

/**
 * Preset library, built for the JBL Tune 730BT.
 *
 * Every entry except "Stock Pure Bass" starts from the 730BT correction curve
 * in `headphoneProfiles.ts` and then leans it in one direction, so switching
 * between them keeps a consistent tonal centre instead of jumping around.
 *
 * The recurring theme is the same: the 730BT ships with a large mid-bass shelf
 * around 60–125 Hz, a scooped 1–2 kHz, and a hot ~8 kHz. Most presets pull those
 * back; the ones that add bass add it at 31 Hz (sub, which the driver actually
 * lacks) rather than at 125 Hz (bloom, which it has too much of).
 */
export const DEFAULT_PRESETS: PresetProfile[] = [
  {
    id: "jbl730-reference",
    name: "730BT Reference",
    description:
      "The house correction: Pure Bass shelf neutralised, scooped mids restored, 8 kHz peak tamed.",
    headphoneModel: "JBL Tune 730BT",
    eqGains: [-3, -5, -4, -1.5, 0.5, 1.5, 2.5, 1, -2.5, 1.5],
    reverbPreset: "none",
    author: "AuraTune",
    likes: 412,
  },
  {
    id: "jbl730-stock",
    name: "Stock Pure Bass",
    description: "Flat 0 dB — exactly what the 730BT sounds like untouched. Use it as an A/B anchor.",
    headphoneModel: "JBL Tune 730BT",
    eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    reverbPreset: "none",
    author: "JBL factory tuning",
    likes: 96,
  },
  {
    id: "jbl730-sub",
    name: "Sub Extension",
    description:
      "Bass without the mud: lifts the 31 Hz sub the 40 mm driver rolls off while cutting the 125 Hz bloom.",
    headphoneModel: "JBL Tune 730BT",
    eqGains: [4, 1, -3, -2, -0.5, 1, 2, 1, -2, 1],
    reverbPreset: "none",
    author: "AuraTune Audio Lab",
    likes: 358,
  },
  {
    id: "jbl730-vocal",
    name: "Voice & Podcast",
    description: "Clears the bass shelf out of the way so speech sits forward and stays intelligible.",
    headphoneModel: "JBL Tune 730BT",
    eqGains: [-6, -6, -3, 0, 2.5, 4, 3.5, 1.5, -2, 0],
    reverbPreset: "none",
    author: "AuraTune Audio Lab",
    likes: 241,
  },
  {
    id: "jbl730-commute",
    name: "Commute (no ANC)",
    description:
      "The 730BT isolates passively only. This cuts the low end that traffic rumble already masks and lifts what survives it.",
    headphoneModel: "JBL Tune 730BT",
    eqGains: [-8, -7, -4, -1, 2, 3, 3, 2, -1, 0],
    reverbPreset: "none",
    author: "AuraTune",
    likes: 187,
  },
  {
    id: "jbl730-gaming",
    name: "Gaming Positional",
    description: "Pushes footstep and cue frequencies forward and pulls explosion bass out of the way.",
    headphoneModel: "JBL Tune 730BT",
    eqGains: [-6, -6, -4, -1, 1, 3, 5, 4, -1, 0],
    reverbPreset: "none",
    author: "AuraTune",
    likes: 274,
  },
  {
    id: "jbl730-late-night",
    name: "Late Night",
    description:
      "Equal-loudness compensation for quiet listening — the ends of the spectrum come back up as volume drops.",
    headphoneModel: "JBL Tune 730BT",
    eqGains: [2, 1, -2, -1.5, 1, 2, 2.5, 2, -1.5, 1],
    reverbPreset: "none",
    author: "AuraTune",
    likes: 143,
  },
  {
    id: "jbl730-acoustic",
    name: "Acoustic & Live",
    description: "Warm lower mids and soft treble for unplugged recordings, with a hall tail for space.",
    headphoneModel: "JBL Tune 730BT",
    eqGains: [-2, -3, -1.5, 0.5, 1, 1.5, 2, 0.5, -3, 0.5],
    reverbPreset: "hall",
    author: "Auralist",
    likes: 168,
  },
];

export interface Track {
  id: string;
  name: string;
  url: string;
  size: number;
}

export interface DspSettings {
  preampDb: number;
  autoGain: boolean;
  eqQ: number;
  saturation: number;
  warmth: number;
  compressorOn: boolean;
  compThreshold: number;
  compRatio: number;
  limiterOn: boolean;
  crossfeed: number;
  balance: number;
  reverbPreset: ReverbPreset;
  reverbAmount: number;
}

const DEFAULT_DSP: DspSettings = {
  preampDb: 0,
  autoGain: true,
  eqQ: 1.41,
  saturation: 0,
  warmth: 0.5,
  compressorOn: false,
  compThreshold: -24,
  compRatio: 4,
  limiterOn: true,
  crossfeed: 0,
  balance: 0,
  reverbPreset: "none",
  reverbAmount: 0.3,
};

interface AudioStoreState {
  hydrated: boolean;
  hydrate: () => void;
  engineStatus: EngineStatus;
  refreshEngineStatus: () => void;

  // ---- EQ ----
  eqGains: number[];
  eqBypassed: boolean;
  activePresetId: string;
  setEQGain: (index: number, value: number) => void;
  setAllEQGains: (gains: number[], presetId?: string) => void;
  nudgeEQGain: (index: number, delta: number) => void;
  resetEQ: () => void;
  toggleEQBypass: () => void;
  applyPreset: (preset: PresetProfile) => void;

  // ---- DSP rack ----
  dsp: DspSettings;
  setDsp: <K extends keyof DspSettings>(key: K, value: DspSettings[K]) => void;

  // ---- Master / transport ----
  masterVolume: number;
  muted: boolean;
  setMasterVolume: (vol: number) => void;
  toggleMute: () => void;

  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  tracks: Track[];
  currentTrackId: string | null;
  addTracks: (files: FileList | File[]) => Track | null;
  selectTrack: (id: string) => void;
  removeTrack: (id: string) => void;

  isMicActive: boolean;
  toggleMic: () => Promise<void>;

  // ---- Output devices ----
  deviceSupport: DeviceSupport;
  outputDevices: AudioOutputDevice[];
  selectedDeviceId: string;
  deviceLabelsHidden: boolean;
  routingActive: boolean;
  detectedProfile: HeadphoneProfile | null;
  /** True when the routed output looks like the JBL Tune 730BT this build targets. */
  primaryConnected: boolean;
  /** Set once the house tuning has been auto-applied, so it only happens on first sight. */
  autoTuneApplied: boolean;
  refreshDevices: () => Promise<void>;
  selectOutputDevice: (deviceId: string) => Promise<void>;
  unlockDeviceLabels: () => Promise<void>;
  openSystemDevicePicker: () => Promise<void>;
  applyDetectedProfile: () => void;
  applyHeadphoneProfile: (profile: HeadphoneProfile) => void;
  maybeAutoTune: (label: string | null | undefined) => void;

  // ---- Bluetooth telemetry ----
  bluetoothConnected: boolean;
  bluetoothDeviceName: string | null;
  bluetoothBattery: number | null;
  bluetoothBatterySupported: boolean;
  connectBluetooth: (jblOnly?: boolean) => Promise<void>;
  disconnectBluetooth: () => void;

  // ---- Noise & binaural ----
  isNoiseActive: boolean;
  noiseColor: NoiseColor;
  noiseVolume: number;
  noiseTone: number;
  setNoiseColor: (color: NoiseColor) => void;
  setNoiseVolume: (volume: number) => void;
  setNoiseTone: (hz: number) => void;
  toggleNoise: () => void;

  isBinauralActive: boolean;
  binauralBaseFreq: number;
  binauralBeatFreq: number;
  binauralVolume: number;
  toggleBinaural: () => void;
  setBinauralParams: (baseFreq: number, beatFreq: number, volume: number) => void;

  // ---- Visualizer ----
  visualizerMode: VisualizerMode;
  setVisualizerMode: (mode: VisualizerMode) => void;

  // ---- Presets ----
  communityPresets: PresetProfile[];
  fetchCommunityPresets: () => Promise<void>;
  saveCustomPreset: (preset: Omit<PresetProfile, "id" | "likes">) => Promise<void>;
  deletePreset: (id: string) => void;
  exportPreset: () => void;
  importPreset: (json: string) => void;

  // ---- Hearing profile ----
  audiogram: Audiogram | null;
  setAudiogram: (audiogram: Audiogram) => void;
  applyAudiogram: () => void;
  clearAudiogram: () => void;
}

/** Trims the preamp so a boosted EQ curve cannot clip the output. */
/**
 * Chooses a preamp level for a given EQ curve.
 *
 * Two competing pulls: tall boosts need headroom so the chain does not clip,
 * while a net-negative curve needs make-up gain or it simply sounds quieter
 * than bypass. Headphone corrections are almost always net-negative — the
 * JBL Pure Bass curve especially, since neutralising it is nearly all cut —
 * so without the make-up term "apply tuning" reads as "turn it down".
 */
function autoPreampFor(gains: number[]): number {
  const peak = Math.max(0, ...gains);
  const headroom = -Math.min(12, peak * 0.85);

  const mean = gains.reduce((sum, g) => sum + g, 0) / gains.length;
  const makeup = mean < 0 ? Math.min(6, -mean * 0.7) : 0;

  return Math.round((headroom + makeup) * 10) / 10;
}

let bluetoothSession: BluetoothSession | null = null;

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  hydrated: false,
  engineStatus: {
    ready: false,
    sampleRate: 0,
    latencyMs: 0,
    state: "uninitialized",
    worklet: "pending",
    sinkId: "",
  },

  hydrate: () => {
    if (get().hydrated) return;

    const eqGains = loadState<number[]>("eqGains", FLAT);
    const dsp = { ...DEFAULT_DSP, ...loadState<Partial<DspSettings>>("dsp", {}) };

    set({
      hydrated: true,
      eqGains: eqGains.length === FLAT.length ? eqGains : FLAT,
      activePresetId: loadState<string>("activePresetId", "jbl730-stock"),
      dsp,
      masterVolume: loadState<number>("masterVolume", 0.8),
      visualizerMode: loadState<VisualizerMode>("visualizerMode", "spectrum"),
      noiseColor: loadState<NoiseColor>("noiseColor", "pink"),
      noiseVolume: loadState<number>("noiseVolume", 0.2),
      noiseTone: loadState<number>("noiseTone", 20000),
      binauralBaseFreq: loadState<number>("binauralBaseFreq", 200),
      binauralBeatFreq: loadState<number>("binauralBeatFreq", 10),
      binauralVolume: loadState<number>("binauralVolume", 0.15),
      selectedDeviceId: loadState<string>("selectedDeviceId", "default"),
      autoTuneApplied: loadState<boolean>("autoTuneApplied", false),
      audiogram: loadState<Audiogram | null>("audiogram", null),
      communityPresets: [
        ...DEFAULT_PRESETS,
        ...loadState<PresetProfile[]>("customPresets", []),
      ],
      deviceSupport: getDeviceSupport(),
    });
  },

  refreshEngineStatus: () => set({ engineStatus: audioEngine.getStatus() }),

  /* ---------------- EQ ---------------- */
  eqGains: FLAT,
  eqBypassed: false,
  activePresetId: "jbl730-stock",

  setEQGain: (index, value) => {
    const eqGains = [...get().eqGains];
    eqGains[index] = value;
    set({ eqGains, activePresetId: "custom" });
    audioEngine.setEQGain(index, value);
    persist("eqGains", eqGains);
    persist("activePresetId", "custom");

    if (get().dsp.autoGain) {
      const preampDb = autoPreampFor(eqGains);
      set((state) => ({ dsp: { ...state.dsp, preampDb } }));
      audioEngine.setPreampDb(preampDb);
    }
  },

  setAllEQGains: (gains, presetId = "custom") => {
    const eqGains = gains.slice(0, FLAT.length);
    set({ eqGains, activePresetId: presetId });
    audioEngine.setAllEQGains(eqGains);
    persist("eqGains", eqGains);
    persist("activePresetId", presetId);

    if (get().dsp.autoGain) {
      const preampDb = autoPreampFor(eqGains);
      set((state) => ({ dsp: { ...state.dsp, preampDb } }));
      audioEngine.setPreampDb(preampDb);
    }
  },

  nudgeEQGain: (index, delta) => {
    const current = get().eqGains[index] ?? 0;
    get().setEQGain(index, Math.max(-18, Math.min(18, Math.round((current + delta) * 2) / 2)));
  },

  resetEQ: () => {
    get().setAllEQGains([...FLAT], "jbl730-stock");
    toast.info("EQ reset", "All bands returned to 0 dB.");
  },

  toggleEQBypass: () => {
    const eqBypassed = !get().eqBypassed;
    set({ eqBypassed });
    audioEngine.setEQBypassed(eqBypassed);
  },

  applyPreset: (preset) => {
    get().setAllEQGains(preset.eqGains, preset.id);
    get().setDsp("reverbPreset", preset.reverbPreset);
    toast.success(`Loaded “${preset.name}”`, preset.headphoneModel);
  },

  /* ---------------- DSP rack ---------------- */
  dsp: DEFAULT_DSP,

  setDsp: (key, value) => {
    const dsp = { ...get().dsp, [key]: value };
    set({ dsp });
    persist("dsp", dsp);

    switch (key) {
      case "preampDb": audioEngine.setPreampDb(dsp.preampDb); break;
      case "eqQ": audioEngine.setEQQ(dsp.eqQ); break;
      case "saturation":
      case "warmth": audioEngine.setSaturation(dsp.saturation, dsp.warmth); break;
      case "compressorOn":
      case "compThreshold":
      case "compRatio":
        audioEngine.setCompressor(dsp.compressorOn, dsp.compThreshold, dsp.compRatio);
        break;
      case "limiterOn": audioEngine.setLimiter(dsp.limiterOn); break;
      case "crossfeed": audioEngine.setCrossfeed(dsp.crossfeed); break;
      case "balance": audioEngine.setBalance(dsp.balance); break;
      case "reverbPreset":
      case "reverbAmount":
        audioEngine.setReverb(dsp.reverbPreset, dsp.reverbAmount);
        break;
      case "autoGain":
        if (dsp.autoGain) {
          const preampDb = autoPreampFor(get().eqGains);
          set((state) => ({ dsp: { ...state.dsp, preampDb } }));
          audioEngine.setPreampDb(preampDb);
        }
        break;
    }
  },

  /* ---------------- Master / transport ---------------- */
  masterVolume: 0.8,
  muted: false,

  setMasterVolume: (vol) => {
    set({ masterVolume: vol, muted: false });
    audioEngine.setMasterVolume(vol);
    persist("masterVolume", vol);
  },

  toggleMute: () => {
    const muted = !get().muted;
    set({ muted });
    audioEngine.setMasterVolume(muted ? 0 : get().masterVolume);
  },

  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  tracks: [],
  currentTrackId: null,

  addTracks: (files) => {
    const incoming = Array.from(files).filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(f.name));
    if (incoming.length === 0) {
      toast.warn("No audio files", "Drop an MP3, WAV, FLAC, OGG or M4A file.");
      return null;
    }

    const tracks: Track[] = incoming.map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      url: URL.createObjectURL(file),
      size: file.size,
    }));

    set((state) => ({
      tracks: [...state.tracks, ...tracks],
      currentTrackId: state.currentTrackId ?? tracks[0].id,
    }));
    return tracks[0];
  },

  selectTrack: (id) => set({ currentTrackId: id }),

  removeTrack: (id) => {
    const track = get().tracks.find((t) => t.id === id);
    if (track) URL.revokeObjectURL(track.url);

    const tracks = get().tracks.filter((t) => t.id !== id);
    const wasCurrent = get().currentTrackId === id;
    set({
      tracks,
      currentTrackId: wasCurrent ? tracks[0]?.id ?? null : get().currentTrackId,
      isPlaying: wasCurrent ? false : get().isPlaying,
    });
  },

  isMicActive: false,
  toggleMic: async () => {
    if (get().isMicActive) {
      audioEngine.disableMicInput();
      set({ isMicActive: false });
      toast.info("Microphone released");
      return;
    }
    const ok = await audioEngine.enableMicInput();
    if (ok) {
      set({ isMicActive: true });
      toast.success("Microphone live", "Input is running through the DSP chain.");
    } else {
      toast.error("Microphone unavailable", "Permission was denied or no input device was found.");
    }
  },

  /* ---------------- Output devices ---------------- */
  deviceSupport: { canEnumerate: false, canRoute: false, canPick: false, canBluetooth: false },
  outputDevices: [],
  selectedDeviceId: "default",
  deviceLabelsHidden: false,
  routingActive: false,
  detectedProfile: null,
  primaryConnected: false,
  autoTuneApplied: false,

  refreshDevices: async () => {
    const { devices, labelsHidden } = await listOutputDevices();
    const selected = devices.find((d) => d.deviceId === get().selectedDeviceId);
    const profile = matchHeadphoneProfile(selected?.label);
    set({
      outputDevices: devices,
      deviceLabelsHidden: labelsHidden,
      detectedProfile: profile,
      primaryConnected: isPrimaryHeadphone(selected?.label),
      deviceSupport: getDeviceSupport(),
    });
    get().maybeAutoTune(selected?.label);
  },

  selectOutputDevice: async (deviceId) => {
    audioEngine.init();
    const ok = await audioEngine.setOutputDevice(deviceId);
    const device = get().outputDevices.find((d) => d.deviceId === deviceId);

    set({
      selectedDeviceId: deviceId,
      routingActive: ok,
      detectedProfile: matchHeadphoneProfile(device?.label),
      primaryConnected: isPrimaryHeadphone(device?.label),
    });
    saveState("selectedDeviceId", deviceId);
    get().maybeAutoTune(device?.label);

    if (ok) {
      toast.success("Output routed", `Audio now plays through ${device?.label ?? "the selected device"}.`);
    } else {
      toast.warn(
        "Routing unavailable",
        "This browser cannot re-target audio output. Choose the device in your OS sound settings instead."
      );
    }
  },

  unlockDeviceLabels: async () => {
    const granted = await requestDeviceLabels();
    if (granted) {
      await get().refreshDevices();
      toast.success("Devices identified", "Your output devices are now listed by name.");
    } else {
      toast.warn("Permission denied", "Device names stay hidden without a one-off audio permission.");
    }
  },

  openSystemDevicePicker: async () => {
    const device = await pickOutputDevice();
    if (!device) return;
    await get().refreshDevices();
    await get().selectOutputDevice(device.deviceId);
  },

  applyDetectedProfile: () => {
    const profile = get().detectedProfile;
    if (profile) get().applyHeadphoneProfile(profile);
  },

  applyHeadphoneProfile: (profile) => {
    get().setAllEQGains(profile.eqGains, `hp-${profile.id}`);
    get().setDsp("crossfeed", profile.crossfeed);
    // With auto-gain on, `autoPreampFor` has already picked a level for this
    // curve and is the single source of truth; only override it when the user
    // has taken manual control of the preamp.
    if (!get().dsp.autoGain) get().setDsp("preampDb", profile.preampDb);
    toast.success(`${profile.brand} ${profile.model} tuning applied`, profile.notes);
  },

  /**
   * Applies the house tuning the first time the target headphone is seen.
   * Gated on a persisted flag so it never overwrites a curve the user has
   * since dialled in themselves.
   */
  maybeAutoTune: (label) => {
    if (get().autoTuneApplied || !isPrimaryHeadphone(label)) return;
    set({ autoTuneApplied: true });
    saveState("autoTuneApplied", true);
    get().applyHeadphoneProfile(PRIMARY_PROFILE);
  },

  /* ---------------- Bluetooth telemetry ---------------- */
  bluetoothConnected: false,
  bluetoothDeviceName: null,
  bluetoothBattery: null,
  bluetoothBatterySupported: false,

  connectBluetooth: async (jblOnly = true) => {
    if (!getDeviceSupport().canBluetooth) {
      toast.error(
        "Web Bluetooth unavailable",
        "Use Chrome, Edge or Brave on desktop or Android. Safari and Firefox do not implement it."
      );
      return;
    }

    try {
      const session = await connectBluetoothTelemetry({
        jblOnly,
        onBattery: (level) => set({ bluetoothBattery: level }),
        onDisconnect: () => {
          set({
            bluetoothConnected: false,
            bluetoothDeviceName: null,
            bluetoothBattery: null,
            bluetoothBatterySupported: false,
          });
          toast.warn("Bluetooth device disconnected");
        },
      });

      bluetoothSession = session;
      set({
        bluetoothConnected: true,
        bluetoothDeviceName: session.deviceName,
        bluetoothBattery: session.battery,
        bluetoothBatterySupported: session.batterySupported,
      });

      if (session.batterySupported) {
        toast.success(`${session.deviceName} linked`, "Battery telemetry is live.");
      } else {
        toast.info(
          `${session.deviceName} linked`,
          "Linked, but this device keeps battery level on a vendor-private service the browser cannot read."
        );
      }
    } catch (err) {
      if (!(err instanceof BluetoothLinkError)) {
        toast.error("Bluetooth link failed", (err as Error)?.message);
        return;
      }

      switch (err.reason) {
        case "cancelled":
          // Either the chooser was dismissed or the filter matched nothing.
          if (jblOnly) {
            toast.info(
              "No JBL device advertising",
              "The 730BT only advertises over BLE while in pairing mode — hold the power button for 5 s until the LED flashes, then try 'Scan all devices'."
            );
          }
          break;
        case "no-gatt":
        case "connect-failed":
          toast.warn(
            "Linked device is not readable",
            "The headphone answered the scan but refused a GATT connection. It is probably already connected to another device."
          );
          break;
        default:
          toast.error("Bluetooth link failed", err.message);
      }
    }
  },

  disconnectBluetooth: () => {
    bluetoothSession?.disconnect();
    bluetoothSession = null;
    set({
      bluetoothConnected: false,
      bluetoothDeviceName: null,
      bluetoothBattery: null,
      bluetoothBatterySupported: false,
    });
  },

  /* ---------------- Noise & binaural ---------------- */
  isNoiseActive: false,
  noiseColor: "pink",
  noiseVolume: 0.2,
  noiseTone: 20000,

  setNoiseColor: (color) => {
    set({ noiseColor: color });
    audioEngine.setNoiseColor(color);
    persist("noiseColor", color);
  },
  setNoiseVolume: (volume) => {
    set({ noiseVolume: volume });
    audioEngine.setNoiseVolume(volume);
    persist("noiseVolume", volume);
  },
  setNoiseTone: (hz) => {
    set({ noiseTone: hz });
    audioEngine.setNoiseTone(hz);
    persist("noiseTone", hz);
  },
  toggleNoise: () => {
    const isNoiseActive = !get().isNoiseActive;
    set({ isNoiseActive });
    if (isNoiseActive) {
      audioEngine.init();
      void audioEngine.resume();
      audioEngine.startNoise(get().noiseColor, get().noiseVolume);
      audioEngine.setNoiseTone(get().noiseTone);
    } else {
      audioEngine.stopNoise();
    }
  },

  isBinauralActive: false,
  binauralBaseFreq: 200,
  binauralBeatFreq: 10,
  binauralVolume: 0.15,

  toggleBinaural: () => {
    const isBinauralActive = !get().isBinauralActive;
    set({ isBinauralActive });
    if (isBinauralActive) {
      audioEngine.init();
      void audioEngine.resume();
    }
    audioEngine.setBinauralBeat(
      isBinauralActive,
      get().binauralBaseFreq,
      get().binauralBeatFreq,
      get().binauralVolume
    );
  },

  setBinauralParams: (baseFreq, beatFreq, volume) => {
    set({ binauralBaseFreq: baseFreq, binauralBeatFreq: beatFreq, binauralVolume: volume });
    persist("binauralBaseFreq", baseFreq);
    persist("binauralBeatFreq", beatFreq);
    persist("binauralVolume", volume);
    if (get().isBinauralActive) {
      audioEngine.setBinauralBeat(true, baseFreq, beatFreq, volume);
    }
  },

  /* ---------------- Visualizer ---------------- */
  visualizerMode: "spectrum",
  setVisualizerMode: (mode) => {
    set({ visualizerMode: mode });
    persist("visualizerMode", mode);
  },

  /* ---------------- Presets ---------------- */
  communityPresets: DEFAULT_PRESETS,

  fetchCommunityPresets: async () => {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${API_BASE}/api/v1/presets`, { signal: controller.signal });
      window.clearTimeout(timeout);
      if (!res.ok) return;

      const data = (await res.json()) as PresetProfile[];
      if (!Array.isArray(data) || data.length === 0) return;

      // Remote presets are merged in without displacing local ones.
      const localIds = new Set(get().communityPresets.map((p) => p.id));
      const fresh = data.filter((p) => !localIds.has(p.id));
      if (fresh.length > 0) {
        set((state) => ({ communityPresets: [...state.communityPresets, ...fresh] }));
      }
    } catch {
      // The Rails API is optional; the bundled presets are the offline path.
    }
  },

  saveCustomPreset: async (presetData) => {
    const preset: PresetProfile = {
      ...presetData,
      id: `custom-${Date.now()}`,
      likes: 0,
      local: true,
    };

    const communityPresets = [preset, ...get().communityPresets];
    set({ communityPresets, activePresetId: preset.id });
    saveState("customPresets", communityPresets.filter((p) => p.local));
    toast.success(`Saved “${preset.name}”`, "Stored on this device.");

    try {
      await fetch(`${API_BASE}/api/v1/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: presetData }),
      });
    } catch {
      // Cloud sync is best-effort; the local copy above is the source of truth.
    }
  },

  deletePreset: (id) => {
    const communityPresets = get().communityPresets.filter((p) => p.id !== id);
    set({ communityPresets });
    saveState("customPresets", communityPresets.filter((p) => p.local));
    toast.info("Preset deleted");
  },

  exportPreset: () => {
    const { eqGains, dsp, activePresetId, communityPresets } = get();
    const source = communityPresets.find((p) => p.id === activePresetId);
    const payload = {
      format: "auratune-preset-v1",
      name: source?.name ?? "Custom Tuning",
      headphoneModel: source?.headphoneModel ?? "Any",
      eqGains,
      reverbPreset: dsp.reverbPreset,
      crossfeed: dsp.crossfeed,
      saturation: dsp.saturation,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${payload.name.replace(/\s+/g, "-").toLowerCase()}.auratune.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Preset exported");
  },

  importPreset: (json) => {
    try {
      const parsed = JSON.parse(json) as {
        name?: string;
        eqGains?: number[];
        reverbPreset?: ReverbPreset;
        crossfeed?: number;
        saturation?: number;
      };

      if (!Array.isArray(parsed.eqGains) || parsed.eqGains.length !== FLAT.length) {
        throw new Error(`Expected ${FLAT.length} EQ bands.`);
      }

      get().setAllEQGains(parsed.eqGains.map(Number));
      if (parsed.reverbPreset) get().setDsp("reverbPreset", parsed.reverbPreset);
      if (typeof parsed.crossfeed === "number") get().setDsp("crossfeed", parsed.crossfeed);
      if (typeof parsed.saturation === "number") get().setDsp("saturation", parsed.saturation);

      toast.success(`Imported “${parsed.name ?? "preset"}”`);
    } catch (err) {
      toast.error("Import failed", (err as Error).message);
    }
  },

  /* ---------------- Hearing profile ---------------- */
  audiogram: null,

  setAudiogram: (audiogram) => {
    set({ audiogram });
    saveState("audiogram", audiogram);
  },

  applyAudiogram: () => {
    const audiogram = get().audiogram;
    if (!audiogram) return;
    get().setAllEQGains(audiogramToEQGains(audiogram), "hearing-profile");
    get().setDsp("balance", audiogramToBalance(audiogram));
    toast.success("Hearing profile applied", "The EQ now compensates for your measured response.");
  },

  clearAudiogram: () => {
    set({ audiogram: null });
    saveState("audiogram", null);
  },
}));
