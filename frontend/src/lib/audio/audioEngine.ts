import {
  createBiquadFilterBank,
  FilterNodeBank,
  EQ_FREQUENCIES,
  ResponseArray,
} from "./biquadFilterBank";
import { createNoiseSynthesizer, NoiseSynthesizer, NoiseColor } from "./noiseSynthesizer";

/** Matches whichever Float32Array flavour the installed DOM lib expects. */
type SampleArray = Parameters<AnalyserNode["getFloatTimeDomainData"]>[0];

export type ReverbPreset = "none" | "room" | "hall" | "cathedral";
export type Ear = "left" | "right" | "both";

export interface EngineStatus {
  ready: boolean;
  sampleRate: number;
  /** Round-trip latency in milliseconds, when the browser reports it. */
  latencyMs: number;
  state: AudioContextState | "uninitialized";
  worklet: "active" | "unavailable" | "pending";
  sinkId: string;
}

/**
 * The DSP graph, in order:
 *
 *   sources → sourceBus → preamp ─┬─ EQ bank ─┬─ postEq → saturator
 *                                 └─ bypass ──┘
 *   → compressor (soft-bypassable) → crossfeed → balance
 *   → dry/wet convolution reverb → limiter → master
 *   → analyser (+ L/R meter taps) → destination
 *
 * Everything is built once and re-parameterised in place; nothing is torn down
 * on a settings change, so adjusting a control never interrupts playback.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;

  private sourceBus: GainNode | null = null;
  private preamp: GainNode | null = null;
  private eqBank: FilterNodeBank | null = null;
  private eqOnGain: GainNode | null = null;
  private eqOffGain: GainNode | null = null;
  private postEq: GainNode | null = null;

  private satIn: GainNode | null = null;
  private satOut: GainNode | null = null;
  private saturator: AudioWorkletNode | null = null;
  private workletState: "active" | "unavailable" | "pending" = "pending";

  private compressor: DynamicsCompressorNode | null = null;
  private compOnGain: GainNode | null = null;
  private compOffGain: GainNode | null = null;
  private compMix: GainNode | null = null;

  private crossfeedIn: GainNode | null = null;
  private crossfeedOut: GainNode | null = null;
  private directL: GainNode | null = null;
  private directR: GainNode | null = null;
  private crossL: GainNode | null = null;
  private crossR: GainNode | null = null;

  private balance: StereoPannerNode | null = null;

  private convolver: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private revMix: GainNode | null = null;

  private limiter: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private auxBus: GainNode | null = null;
  private testBus: GainNode | null = null;

  private analyser: AnalyserNode | null = null;
  private meterL: AnalyserNode | null = null;
  private meterR: AnalyserNode | null = null;
  private meterBuf = new Float32Array(1024) as SampleArray;

  private noiseSynth: NoiseSynthesizer | null = null;

  private audioElement: HTMLAudioElement | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micStreamSource: MediaStreamAudioSourceNode | null = null;

  private reverbBuffers = new Map<ReverbPreset, AudioBuffer>();
  private reverbAmount = 0;
  private currentReverb: ReverbPreset = "none";
  private pendingSinkId: string | null = null;
  private testTone: { osc: OscillatorNode; gain: GainNode } | null = null;

  /* ---------------------------------------------------------------- *
   * Lifecycle
   * ---------------------------------------------------------------- */

  public init(): AudioContext {
    if (this.ctx && this.ctx.state !== "closed") {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }

    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;

    const gain = (value = 1) => {
      const node = ctx.createGain();
      node.gain.value = value;
      return node;
    };

    // --- Input & preamp -------------------------------------------------
    this.sourceBus = gain(1);
    this.preamp = gain(1);
    this.sourceBus.connect(this.preamp);

    // --- EQ, with a parallel dry path for instant A/B bypass ------------
    this.eqBank = createBiquadFilterBank(ctx);
    this.eqOnGain = gain(1);
    this.eqOffGain = gain(0);
    this.postEq = gain(1);

    this.preamp.connect(this.eqBank.input);
    this.eqBank.output.connect(this.eqOnGain);
    this.eqOnGain.connect(this.postEq);
    this.preamp.connect(this.eqOffGain);
    this.eqOffGain.connect(this.postEq);

    // --- Saturator placeholder; the worklet is spliced in when it loads --
    this.satIn = gain(1);
    this.satOut = gain(1);
    this.postEq.connect(this.satIn);
    this.satIn.connect(this.satOut);
    void this.loadSaturatorWorklet();

    // --- Compressor, bypassed by crossfade rather than reconnection ------
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.006;
    this.compressor.release.value = 0.25;

    this.compOnGain = gain(0);
    this.compOffGain = gain(1);
    this.compMix = gain(1);

    this.satOut.connect(this.compressor);
    this.compressor.connect(this.compOnGain);
    this.compOnGain.connect(this.compMix);
    this.satOut.connect(this.compOffGain);
    this.compOffGain.connect(this.compMix);

    // --- Crossfeed: a lowpassed, delayed bleed between channels ---------
    // Speakers let each ear hear both channels; headphones do not, which is
    // what makes hard-panned mixes feel unnaturally wide. This restores it.
    this.crossfeedIn = gain(1);
    this.crossfeedOut = gain(1);
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);

    this.directL = gain(1);
    this.directR = gain(1);
    this.crossL = gain(0);
    this.crossR = gain(0);

    const makeCrossPath = (target: GainNode) => {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      lp.Q.value = 0.6;
      const delay = ctx.createDelay(0.01);
      delay.delayTime.value = 0.00027; // ~270 µs inter-aural time difference
      lp.connect(delay);
      delay.connect(target);
      return lp;
    };

    const lpFromL = makeCrossPath(this.crossR);
    const lpFromR = makeCrossPath(this.crossL);

    this.crossfeedIn.connect(splitter);
    splitter.connect(this.directL, 0);
    splitter.connect(this.directR, 1);
    splitter.connect(lpFromL, 0);
    splitter.connect(lpFromR, 1);

    this.directL.connect(merger, 0, 0);
    this.directR.connect(merger, 0, 1);
    this.crossR.connect(merger, 0, 1); // left content bled into the right ear
    this.crossL.connect(merger, 0, 0); // right content bled into the left ear
    merger.connect(this.crossfeedOut);

    this.compMix.connect(this.crossfeedIn);

    // --- Channel balance ------------------------------------------------
    this.balance = ctx.createStereoPanner();
    this.crossfeedOut.connect(this.balance);

    // --- Convolution reverb with a real dry/wet split -------------------
    this.convolver = ctx.createConvolver();
    this.convolver.normalize = true;
    this.dryGain = gain(1);
    this.wetGain = gain(0);
    this.revMix = gain(1);

    this.balance.connect(this.dryGain);
    this.dryGain.connect(this.revMix);
    this.balance.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.revMix);

    // --- Brickwall-ish limiter ------------------------------------------
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.08;
    this.revMix.connect(this.limiter);

    // --- Master, metering, output ---------------------------------------
    this.masterGain = gain(0.8);
    this.limiter.connect(this.masterGain);

    this.auxBus = gain(1); // noise / binaural, deliberately outside the EQ
    this.auxBus.connect(this.masterGain);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.8;
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    const meterSplit = ctx.createChannelSplitter(2);
    this.meterL = ctx.createAnalyser();
    this.meterR = ctx.createAnalyser();
    this.meterL.fftSize = 1024;
    this.meterR.fftSize = 1024;
    this.masterGain.connect(meterSplit);
    meterSplit.connect(this.meterL, 0);
    meterSplit.connect(this.meterR, 1);

    // Test tones bypass the whole chain — an uncalibrated path would make the
    // hearing test meaningless.
    this.testBus = gain(1);
    this.testBus.connect(ctx.destination);

    this.noiseSynth = createNoiseSynthesizer(ctx, this.auxBus);

    this.createImpulseResponse("room");
    if (this.pendingSinkId) void this.setOutputDevice(this.pendingSinkId);

    return ctx;
  }

  private async loadSaturatorWorklet() {
    const ctx = this.ctx;
    if (!ctx || !ctx.audioWorklet || !this.satIn || !this.satOut) {
      this.workletState = "unavailable";
      return;
    }
    try {
      await ctx.audioWorklet.addModule("/worklets/saturator.js");
      const node = new AudioWorkletNode(ctx, "tube-saturator", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      // Splice it in between the two placeholder gains.
      this.satIn.disconnect(this.satOut);
      this.satIn.connect(node);
      node.connect(this.satOut);
      this.saturator = node;
      this.workletState = "active";
    } catch (err) {
      // Keep the straight-through connection; the studio still works without it.
      console.warn("[AuraTune] Tube saturator worklet unavailable:", err);
      this.workletState = "unavailable";
    }
  }

  public async resume(): Promise<void> {
    if (!this.ctx) this.init();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  public getStatus(): EngineStatus {
    const ctx = this.ctx;
    if (!ctx) {
      return {
        ready: false,
        sampleRate: 0,
        latencyMs: 0,
        state: "uninitialized",
        worklet: this.workletState,
        sinkId: "",
      };
    }
    const base = ctx.baseLatency ?? 0;
    const out = ctx.outputLatency ?? 0;
    return {
      ready: true,
      sampleRate: ctx.sampleRate,
      latencyMs: Math.round((base + out) * 10000) / 10,
      state: ctx.state,
      worklet: this.workletState,
      sinkId: typeof ctx.sinkId === "string" ? ctx.sinkId : "",
    };
  }

  /* ---------------------------------------------------------------- *
   * Output routing — the "connect my headphones" path
   * ---------------------------------------------------------------- */

  public async setOutputDevice(deviceId: string): Promise<boolean> {
    if (!this.ctx) {
      this.pendingSinkId = deviceId;
      return false;
    }
    const setSinkId = this.ctx.setSinkId;
    if (typeof setSinkId !== "function") return false;

    try {
      await setSinkId.call(this.ctx, deviceId === "default" ? "" : deviceId);
      this.pendingSinkId = null;
      // Mirror the routing onto the media element so browsers that render the
      // element independently of the graph stay in sync.
      if (this.audioElement?.setSinkId) {
        try {
          await this.audioElement.setSinkId(deviceId);
        } catch {
          /* element-level routing is a nicety, not a requirement */
        }
      }
      return true;
    } catch (err) {
      console.warn("[AuraTune] Could not route audio to device:", err);
      return false;
    }
  }

  /* ---------------------------------------------------------------- *
   * Sources
   * ---------------------------------------------------------------- */

  public connectAudioElement(audio: HTMLAudioElement) {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.sourceBus) return;

    // A media element can only ever be wrapped once, so reuse the source node.
    if (this.audioElement === audio && this.mediaElementSource) return;

    if (this.mediaElementSource) {
      try {
        this.mediaElementSource.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.audioElement = audio;
    this.mediaElementSource = this.ctx.createMediaElementSource(audio);
    this.mediaElementSource.connect(this.sourceBus);
  }

  public async enableMicInput(): Promise<boolean> {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.sourceBus) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      this.disableMicInput();
      this.micStream = stream;
      this.micStreamSource = this.ctx.createMediaStreamSource(stream);
      this.micStreamSource.connect(this.sourceBus);
      return true;
    } catch (err) {
      console.error("[AuraTune] Microphone input unavailable:", err);
      return false;
    }
  }

  /** Fully releases the microphone — the previous build left it live. */
  public disableMicInput() {
    if (this.micStreamSource) {
      try {
        this.micStreamSource.disconnect();
      } catch {
        /* ignore */
      }
      this.micStreamSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
  }

  /* ---------------------------------------------------------------- *
   * Parameters
   * ---------------------------------------------------------------- */

  private ramp(param: AudioParam | undefined | null, value: number, tau = 0.02) {
    if (!param || !this.ctx) return;
    param.setTargetAtTime(value, this.ctx.currentTime, tau);
  }

  public setEQGain(index: number, gainDb: number) {
    this.eqBank?.setGain(index, gainDb);
  }

  public setAllEQGains(gains: number[]) {
    this.eqBank?.setAllGains(gains);
  }

  public setEQBypassed(bypassed: boolean) {
    // Equal-power-ish crossfade between the two parallel paths.
    this.ramp(this.eqOnGain?.gain, bypassed ? 0 : 1, 0.008);
    this.ramp(this.eqOffGain?.gain, bypassed ? 1 : 0, 0.008);
  }

  public setEQQ(q: number) {
    this.eqBank?.setQ(q);
  }

  public setPreampDb(db: number) {
    this.ramp(this.preamp?.gain, Math.pow(10, db / 20));
  }

  public setMasterVolume(volume: number) {
    this.ramp(this.masterGain?.gain, volume, 0.015);
  }

  public setSaturation(amount: number, warmth = 0.5) {
    if (!this.saturator || !this.ctx) return;
    const drive = this.saturator.parameters.get("drive");
    const warm = this.saturator.parameters.get("warmth");
    drive?.setTargetAtTime(amount, this.ctx.currentTime, 0.03);
    warm?.setTargetAtTime(warmth, this.ctx.currentTime, 0.03);
  }

  public setCompressor(enabled: boolean, threshold = -24, ratio = 4) {
    if (this.compressor && this.ctx) {
      this.ramp(this.compressor.threshold, threshold, 0.05);
      this.ramp(this.compressor.ratio, ratio, 0.05);
    }
    this.ramp(this.compOnGain?.gain, enabled ? 1 : 0, 0.02);
    this.ramp(this.compOffGain?.gain, enabled ? 0 : 1, 0.02);
  }

  /** Live gain reduction in dB (negative), for the compressor meter. */
  public getCompressorReduction(): number {
    return this.compressor?.reduction ?? 0;
  }

  public setCrossfeed(amount: number) {
    const a = Math.max(0, Math.min(1, amount));
    // Trim the direct path as the bleed comes up so the total stays level.
    this.ramp(this.crossL?.gain, a * 0.5);
    this.ramp(this.crossR?.gain, a * 0.5);
    this.ramp(this.directL?.gain, 1 - a * 0.25);
    this.ramp(this.directR?.gain, 1 - a * 0.25);
  }

  public setBalance(value: number) {
    this.ramp(this.balance?.pan, Math.max(-1, Math.min(1, value)));
  }

  public setReverb(preset: ReverbPreset, amount: number) {
    this.currentReverb = preset;
    this.reverbAmount = amount;

    if (preset === "none") {
      this.ramp(this.wetGain?.gain, 0, 0.05);
      this.ramp(this.dryGain?.gain, 1, 0.05);
      return;
    }
    this.createImpulseResponse(preset);
    this.ramp(this.wetGain?.gain, amount, 0.05);
    this.ramp(this.dryGain?.gain, 1 - amount * 0.35, 0.05);
  }

  public setLimiter(enabled: boolean) {
    if (!this.limiter) return;
    this.ramp(this.limiter.threshold, enabled ? -1.5 : 0, 0.05);
    this.ramp(this.limiter.ratio, enabled ? 20 : 1, 0.05);
  }

  /* ---------------------------------------------------------------- *
   * Noise & binaural
   * ---------------------------------------------------------------- */

  public startNoise(color: NoiseColor, volume: number) {
    if (!this.ctx) this.init();
    this.noiseSynth?.start(color, volume);
  }
  public stopNoise() {
    this.noiseSynth?.stop();
  }
  public setNoiseVolume(volume: number) {
    this.noiseSynth?.setVolume(volume);
  }
  public setNoiseColor(color: NoiseColor) {
    this.noiseSynth?.setColor(color);
  }
  public setNoiseTone(cutoffHz: number) {
    this.noiseSynth?.setTone(cutoffHz);
  }
  public setBinauralBeat(enabled: boolean, baseFreq: number, beatFreq: number, volume: number) {
    if (!this.ctx) this.init();
    this.noiseSynth?.setBinauralBeat(enabled, baseFreq, beatFreq, volume);
  }

  /* ---------------------------------------------------------------- *
   * Hearing test tones
   * ---------------------------------------------------------------- */

  /**
   * Plays a calibrated sine into one ear, routed around the DSP chain.
   * `level` is 0–1 linear amplitude; tones are faded to avoid audible clicks.
   */
  public startTestTone(freq: number, ear: Ear, level: number) {
    if (!this.ctx) this.init();
    const ctx = this.ctx;
    if (!ctx || !this.testBus) return;

    this.stopTestTone();

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    if (ear === "both") {
      gainNode.connect(this.testBus);
    } else {
      const merger = ctx.createChannelMerger(2);
      gainNode.connect(merger, 0, ear === "left" ? 0 : 1);
      merger.connect(this.testBus);
    }

    osc.connect(gainNode);
    osc.start();
    gainNode.gain.setTargetAtTime(level, ctx.currentTime, 0.03);
    this.testTone = { osc, gain: gainNode };
  }

  public setTestToneLevel(level: number) {
    if (this.testTone && this.ctx) {
      this.testTone.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.03);
    }
  }

  public stopTestTone() {
    const tone = this.testTone;
    const ctx = this.ctx;
    if (!tone || !ctx) return;
    this.testTone = null;

    tone.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    const osc = tone.osc;
    window.setTimeout(() => {
      try {
        osc.stop();
        osc.disconnect();
        tone.gain.disconnect();
      } catch {
        /* already stopped */
      }
    }, 120);
  }

  /* ---------------------------------------------------------------- *
   * Analysis
   * ---------------------------------------------------------------- */

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  /** Peak levels in dBFS for the L/R output meters. */
  public getPeakLevels(): { left: number; right: number } {
    const read = (node: AnalyserNode | null): number => {
      if (!node) return -Infinity;
      if (this.meterBuf.length !== node.fftSize) {
        this.meterBuf = new Float32Array(node.fftSize) as SampleArray;
      }
      node.getFloatTimeDomainData(this.meterBuf);
      let peak = 0;
      for (let i = 0; i < this.meterBuf.length; i++) {
        const abs = Math.abs(this.meterBuf[i]);
        if (abs > peak) peak = abs;
      }
      return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    };
    return { left: read(this.meterL), right: read(this.meterR) };
  }

  /** Actual measured magnitude response of the EQ chain, in dB. */
  public getEQResponse(frequencies: ResponseArray): Float32Array | null {
    return this.eqBank?.getResponseCurve(frequencies) ?? null;
  }

  /* ---------------------------------------------------------------- *
   * Impulse responses
   * ---------------------------------------------------------------- */

  private createImpulseResponse(preset: ReverbPreset) {
    const ctx = this.ctx;
    if (!ctx || !this.convolver || preset === "none") return;

    // Synthesising an IR is not cheap, so each one is generated once and cached.
    const cached = this.reverbBuffers.get(preset);
    if (cached) {
      this.convolver.buffer = cached;
      return;
    }

    const spec = {
      room: { duration: 0.9, decay: 2.2, predelay: 0.006 },
      hall: { duration: 2.6, decay: 2.8, predelay: 0.022 },
      cathedral: { duration: 5.0, decay: 3.4, predelay: 0.045 },
    }[preset];

    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * spec.duration);
    const preDelay = Math.floor(sampleRate * spec.predelay);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      // Lowpass the noise as it decays — real rooms lose treble first.
      let lp = 0;
      for (let i = preDelay; i < length; i++) {
        const t = (i - preDelay) / (length - preDelay);
        const envelope = Math.pow(1 - t, spec.decay);
        const white = Math.random() * 2 - 1;
        const damping = 0.25 + 0.6 * (1 - t);
        lp += damping * (white - lp);
        data[i] = lp * envelope;
      }
    }

    this.reverbBuffers.set(preset, impulse);
    this.convolver.buffer = impulse;
  }

  /* ---------------------------------------------------------------- *
   * Teardown
   * ---------------------------------------------------------------- */

  public dispose() {
    this.stopTestTone();
    this.stopNoise();
    this.disableMicInput();
    try {
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
  }
}

export const audioEngine = new AudioEngine();
export { EQ_FREQUENCIES };
