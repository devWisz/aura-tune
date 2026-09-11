export type NoiseColor = "white" | "pink" | "brown" | "rain" | "surf";

export interface NoiseSynthesizer {
  start: (color: NoiseColor, volume: number) => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  setColor: (color: NoiseColor) => void;
  /** Lowpass cutoff over the noise bed, 200 Hz (muffled) – 20 kHz (open). */
  setTone: (cutoffHz: number) => void;
  setBinauralBeat: (enabled: boolean, baseFreq: number, beatFreq: number, volume: number) => void;
  isRunning: () => boolean;
}

export const NOISE_COLORS: { id: NoiseColor; label: string; blurb: string }[] = [
  { id: "white", label: "White", blurb: "Flat energy — masks chatter and keyboards" },
  { id: "pink", label: "Pink", blurb: "−3 dB/octave — the most natural-sounding bed" },
  { id: "brown", label: "Brown", blurb: "−6 dB/octave — deep, rumbling, low fatigue" },
  { id: "rain", label: "Rain", blurb: "Filtered noise with drifting rainfall texture" },
  { id: "surf", label: "Surf", blurb: "Slow swelling waves for long focus blocks" },
];

export function createNoiseSynthesizer(
  audioCtx: AudioContext,
  destinationNode: AudioNode
): NoiseSynthesizer {
  let activeSource: AudioBufferSourceNode | null = null;
  let noiseGain: GainNode | null = null;
  let toneFilter: BiquadFilterNode | null = null;
  let modulator: { osc: OscillatorNode; depth: GainNode } | null = null;

  let currentColor: NoiseColor = "pink";
  let currentVolume = 0.2;
  let currentTone = 20000;
  let running = false;

  // Buffers are expensive to synthesise, so each colour is generated once.
  const bufferCache = new Map<NoiseColor, AudioBuffer>();
  const bufferSeconds = 6;

  const fillWhite = (out: Float32Array) => {
    for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1;
  };

  const fillPink = (out: Float32Array) => {
    // Paul Kellet's refined pink-noise filter.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < out.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  };

  const fillBrown = (out: Float32Array) => {
    let last = 0;
    for (let i = 0; i < out.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      out[i] = last * 3.5;
    }
  };

  const fillRain = (out: Float32Array, sampleRate: number) => {
    // A bright noise bed plus sparse transients that read as individual drops.
    fillPink(out);
    for (let i = 0; i < out.length; i++) out[i] *= 0.55;

    const dropCount = Math.floor(out.length / sampleRate) * 900;
    for (let d = 0; d < dropCount; d++) {
      const at = Math.floor(Math.random() * (out.length - 400));
      const amp = 0.12 + Math.random() * 0.3;
      const decay = 40 + Math.random() * 220;
      for (let i = 0; i < decay && at + i < out.length; i++) {
        out[at + i] += (Math.random() * 2 - 1) * amp * (1 - i / decay);
      }
    }
  };

  const fillSurf = (out: Float32Array, sampleRate: number) => {
    // Brown noise under a slow, slightly irregular swell.
    fillBrown(out);
    const wavePeriod = sampleRate * 9;
    for (let i = 0; i < out.length; i++) {
      const phase = (i % wavePeriod) / wavePeriod;
      const swell = 0.35 + 0.65 * Math.pow(Math.sin(phase * Math.PI), 1.6);
      out[i] *= swell;
    }
  };

  const getBuffer = (color: NoiseColor): AudioBuffer => {
    const cached = bufferCache.get(color);
    if (cached) return cached;

    const sampleRate = audioCtx.sampleRate;
    const length = Math.floor(sampleRate * bufferSeconds);
    const buffer = audioCtx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      switch (color) {
        case "white": fillWhite(data); break;
        case "brown": fillBrown(data); break;
        case "rain": fillRain(data, sampleRate); break;
        case "surf": fillSurf(data, sampleRate); break;
        default: fillPink(data);
      }
    }

    // Crossfade the loop seam so the 6-second wrap is not audible as a click.
    const fade = Math.floor(sampleRate * 0.05);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        data[i] = data[i] * t + data[length - fade + i] * (1 - t);
      }
    }

    bufferCache.set(color, buffer);
    return buffer;
  };

  const teardown = () => {
    if (modulator) {
      try { modulator.osc.stop(); } catch { /* ignore */ }
      modulator.osc.disconnect();
      modulator.depth.disconnect();
      modulator = null;
    }
    if (activeSource) {
      try { activeSource.stop(); } catch { /* ignore */ }
      activeSource.disconnect();
      activeSource = null;
    }
    if (toneFilter) { toneFilter.disconnect(); toneFilter = null; }
    if (noiseGain) { noiseGain.disconnect(); noiseGain = null; }
  };

  const stop = () => {
    if (!running) return teardown();
    running = false;

    // Fade out before tearing down, otherwise stopping clicks.
    const gainNode = noiseGain;
    const dying = { source: activeSource, gain: gainNode, filter: toneFilter, mod: modulator };
    activeSource = null;
    noiseGain = null;
    toneFilter = null;
    modulator = null;

    gainNode?.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08);
    window.setTimeout(() => {
      try {
        dying.mod?.osc.stop();
        dying.mod?.osc.disconnect();
        dying.mod?.depth.disconnect();
        dying.source?.stop();
        dying.source?.disconnect();
        dying.filter?.disconnect();
        dying.gain?.disconnect();
      } catch { /* already gone */ }
    }, 350);
  };

  const start = (color: NoiseColor, volume: number) => {
    stop();
    currentColor = color;
    currentVolume = volume;

    const source = audioCtx.createBufferSource();
    source.buffer = getBuffer(color);
    source.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = currentTone;
    filter.Q.value = 0.7;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(destinationNode);
    source.start(0);

    // Rain gets a slow filter sweep so it never sounds like a static loop.
    if (color === "rain") {
      const osc = audioCtx.createOscillator();
      const depth = audioCtx.createGain();
      osc.frequency.value = 0.06;
      depth.gain.value = Math.min(currentTone * 0.25, 1800);
      osc.connect(depth);
      depth.connect(filter.frequency);
      osc.start();
      modulator = { osc, depth };
    }

    gainNode.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.12);

    activeSource = source;
    toneFilter = filter;
    noiseGain = gainNode;
    running = true;
  };

  const setVolume = (volume: number) => {
    currentVolume = volume;
    noiseGain?.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.02);
  };

  const setColor = (color: NoiseColor) => {
    if (currentColor === color) return;
    currentColor = color;
    if (running) start(color, currentVolume);
  };

  const setTone = (cutoffHz: number) => {
    currentTone = Math.max(120, Math.min(20000, cutoffHz));
    toneFilter?.frequency.setTargetAtTime(currentTone, audioCtx.currentTime, 0.05);
  };

  /* ---------------------------------------------------------------- *
   * Binaural beats
   * ---------------------------------------------------------------- */
  let leftOsc: OscillatorNode | null = null;
  let rightOsc: OscillatorNode | null = null;
  let binauralGain: GainNode | null = null;
  let merger: ChannelMergerNode | null = null;

  const stopBinaural = (immediate = false) => {
    if (!binauralGain) return;
    const dying = { leftOsc, rightOsc, gain: binauralGain, merger };
    leftOsc = null;
    rightOsc = null;
    binauralGain = null;
    merger = null;

    const kill = () => {
      try {
        dying.leftOsc?.stop();
        dying.rightOsc?.stop();
        dying.leftOsc?.disconnect();
        dying.rightOsc?.disconnect();
        dying.merger?.disconnect();
        dying.gain?.disconnect();
      } catch { /* already gone */ }
    };

    if (immediate) return kill();
    dying.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    window.setTimeout(kill, 250);
  };

  const setBinauralBeat = (enabled: boolean, baseFreq = 200, beatFreq = 10, volume = 0.15) => {
    // Retune in place when already running, so sliding the beat frequency
    // glides instead of restarting the tone.
    if (enabled && leftOsc && rightOsc && binauralGain) {
      const now = audioCtx.currentTime;
      leftOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
      rightOsc.frequency.setTargetAtTime(baseFreq + beatFreq, now, 0.05);
      binauralGain.gain.setTargetAtTime(volume, now, 0.05);
      return;
    }

    stopBinaural();
    if (!enabled) return;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;
    const merge = audioCtx.createChannelMerger(2);

    const left = audioCtx.createOscillator();
    const right = audioCtx.createOscillator();
    left.type = "sine";
    right.type = "sine";
    left.frequency.value = baseFreq;
    right.frequency.value = baseFreq + beatFreq;

    left.connect(merge, 0, 0);
    right.connect(merge, 0, 1);
    merge.connect(gainNode);
    gainNode.connect(destinationNode);

    left.start();
    right.start();
    gainNode.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.15);

    leftOsc = left;
    rightOsc = right;
    binauralGain = gainNode;
    merger = merge;
  };

  return {
    start,
    stop,
    setVolume,
    setColor,
    setTone,
    setBinauralBeat,
    isRunning: () => running,
  };
}
