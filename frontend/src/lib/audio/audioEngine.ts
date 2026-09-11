import { createBiquadFilterBank, FilterNodeBank, EQ_FREQUENCIES } from "./biquadFilterBank";
import { createNoiseSynthesizer, NoiseSynthesizer, NoiseColor } from "./noiseSynthesizer";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private eqBank: FilterNodeBank | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private convolver: ConvolverNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseSynth: NoiseSynthesizer | null = null;

  // Audio Sources
  private audioElement: HTMLAudioElement | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private micStreamSource: MediaStreamAudioSourceNode | null = null;
  private isInitialized = false;

  public init(): AudioContext {
    if (this.ctx && this.ctx.state !== "closed") {
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      return this.ctx;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // 1. Create Biquad Filter Bank (10-Band EQ)
    this.eqBank = createBiquadFilterBank(this.ctx);

    // 2. Dynamics Compressor Node
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    // 3. Convolver Reverb Node
    this.convolver = this.ctx.createConvolver();
    this.createSyntheticImpulseResponse("room");

    // 4. Master Gain Node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

    // 5. Analyser Node (60FPS FFT)
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.85;

    // Connect Node Graph:
    // eqLast -> compressor -> convolver -> masterGain -> analyser -> destination
    const lastEqFilter = this.eqBank.filters[this.eqBank.filters.length - 1];
    lastEqFilter.connect(this.compressor);
    this.compressor.connect(this.convolver);
    this.convolver.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // 6. Noise Synthesizer Node (injects into master gain)
    this.noiseSynth = createNoiseSynthesizer(this.ctx, this.masterGain);

    this.isInitialized = true;
    return this.ctx;
  }

  public connectAudioElement(audio: HTMLAudioElement) {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.eqBank) return;

    if (this.audioElement !== audio) {
      if (this.mediaElementSource) {
        try { this.mediaElementSource.disconnect(); } catch (e) { /* ignore */ }
      }
      this.audioElement = audio;
      this.mediaElementSource = this.ctx.createMediaElementSource(audio);
      this.mediaElementSource.connect(this.eqBank.filters[0]);
    }
  }

  public async enableMicInput(): Promise<boolean> {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.eqBank) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (this.micStreamSource) {
        this.micStreamSource.disconnect();
      }
      this.micStreamSource = this.ctx.createMediaStreamSource(stream);
      this.micStreamSource.connect(this.eqBank.filters[0]);
      return true;
    } catch (err) {
      console.error("Failed to access microphone input:", err);
      return false;
    }
  }

  public setEQGain(freqIndex: number, gainDb: number) {
    if (this.eqBank) {
      this.eqBank.setGain(freqIndex, gainDb);
    }
  }

  public setAllEQGains(gains: number[]) {
    if (this.eqBank) {
      this.eqBank.setAllGains(gains);
    }
  }

  public setMasterVolume(volume: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.015);
    }
  }

  public setReverbPreset(preset: "none" | "room" | "hall" | "cathedral") {
    if (!this.convolver || !this.ctx) return;
    this.createSyntheticImpulseResponse(preset);
  }

  public startNoise(color: NoiseColor, volume: number) {
    if (!this.ctx) this.init();
    if (this.noiseSynth) {
      this.noiseSynth.start(color, volume);
    }
  }

  public stopNoise() {
    if (this.noiseSynth) {
      this.noiseSynth.stop();
    }
  }

  public setNoiseVolume(volume: number) {
    if (this.noiseSynth) {
      this.noiseSynth.setVolume(volume);
    }
  }

  public setNoiseColor(color: NoiseColor) {
    if (this.noiseSynth) {
      this.noiseSynth.setColor(color);
    }
  }

  public setBinauralBeat(enabled: boolean, baseFreq: number, beatFreq: number, volume: number) {
    if (!this.ctx) this.init();
    if (this.noiseSynth) {
      this.noiseSynth.setBinauralBeat(enabled, baseFreq, beatFreq, volume);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  private createSyntheticImpulseResponse(preset: "none" | "room" | "hall" | "cathedral") {
    if (!this.ctx || !this.convolver) return;

    if (preset === "none") {
      // Clean bypass buffer (1 sample impulse)
      const buffer = this.ctx.createBuffer(2, 1, this.ctx.sampleRate);
      buffer.getChannelData(0)[0] = 1;
      buffer.getChannelData(1)[0] = 1;
      this.convolver.buffer = buffer;
      return;
    }

    let duration = 1.0; // Room duration
    let decay = 2.0;

    if (preset === "hall") {
      duration = 2.5;
      decay = 3.0;
    } else if (preset === "cathedral") {
      duration = 5.0;
      decay = 4.5;
    }

    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      const envelope = Math.pow(n / length, decay);
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }

    this.convolver.buffer = impulse;
  }
}

// Singleton instance export
export const audioEngine = new AudioEngine();
