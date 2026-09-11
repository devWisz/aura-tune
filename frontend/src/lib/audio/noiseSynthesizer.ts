export type NoiseColor = "white" | "pink" | "brown";

export interface NoiseSynthesizer {
  start: (color: NoiseColor, volume: number) => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  setColor: (color: NoiseColor) => void;
  setBinauralBeat: (enabled: boolean, baseFreq: number, beatFreq: number, volume: number) => void;
}

export function createNoiseSynthesizer(
  audioCtx: AudioContext,
  destinationNode: AudioNode
): NoiseSynthesizer {
  let activeSource: AudioBufferSourceNode | null = null;
  let noiseGainNode: GainNode | null = null;
  let currentColor: NoiseColor = "pink";
  let currentVolume = 0.2;

  // Binaural beats nodes
  let leftOsc: OscillatorNode | null = null;
  let rightOsc: OscillatorNode | null = null;
  let binauralGain: GainNode | null = null;
  let merger: ChannelMergerNode | null = null;

  const bufferSize = audioCtx.sampleRate * 4; // 4 seconds buffer loop

  // Procedural Noise Buffer Generators
  const createWhiteNoiseBuffer = (): AudioBuffer => {
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  };

  const createPinkNoiseBuffer = (): AudioBuffer => {
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  };

  const createBrownNoiseBuffer = (): AudioBuffer => {
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOutput = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOutput + 0.02 * white) / 1.02;
      lastOutput = output[i];
      output[i] *= 3.5;
    }
    return buffer;
  };

  const getNoiseBuffer = (color: NoiseColor): AudioBuffer => {
    switch (color) {
      case "white": return createWhiteNoiseBuffer();
      case "brown": return createBrownNoiseBuffer();
      case "pink":
      default: return createPinkNoiseBuffer();
    }
  };

  const stop = () => {
    if (activeSource) {
      try {
        activeSource.stop();
        activeSource.disconnect();
      } catch (e) { /* ignore */ }
      activeSource = null;
    }
    if (noiseGainNode) {
      noiseGainNode.disconnect();
      noiseGainNode = null;
    }
  };

  const start = (color: NoiseColor, volume: number) => {
    stop();
    currentColor = color;
    currentVolume = volume;

    const buffer = getNoiseBuffer(color);
    activeSource = audioCtx.createBufferSource();
    activeSource.buffer = buffer;
    activeSource.loop = true;

    noiseGainNode = audioCtx.createGain();
    noiseGainNode.gain.value = volume;

    activeSource.connect(noiseGainNode);
    noiseGainNode.connect(destinationNode);
    activeSource.start(0);
  };

  const setVolume = (volume: number) => {
    currentVolume = volume;
    if (noiseGainNode) {
      noiseGainNode.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.015);
    }
  };

  const setColor = (color: NoiseColor) => {
    if (currentColor !== color && activeSource) {
      start(color, currentVolume);
    }
  };

  const stopBinaural = () => {
    if (leftOsc) { leftOsc.stop(); leftOsc.disconnect(); leftOsc = null; }
    if (rightOsc) { rightOsc.stop(); rightOsc.disconnect(); rightOsc = null; }
    if (binauralGain) { binauralGain.disconnect(); binauralGain = null; }
    if (merger) { merger.disconnect(); merger = null; }
  };

  const setBinauralBeat = (enabled: boolean, baseFreq = 200, beatFreq = 10, volume = 0.15) => {
    stopBinaural();
    if (!enabled) return;

    binauralGain = audioCtx.createGain();
    binauralGain.gain.value = volume;

    merger = audioCtx.createChannelMerger(2);

    leftOsc = audioCtx.createOscillator();
    rightOsc = audioCtx.createOscillator();

    leftOsc.frequency.value = baseFreq;
    rightOsc.frequency.value = baseFreq + beatFreq;

    leftOsc.connect(merger, 0, 0); // Left ear
    rightOsc.connect(merger, 0, 1); // Right ear

    merger.connect(binauralGain);
    binauralGain.connect(destinationNode);

    leftOsc.start();
    rightOsc.start();
  };

  return {
    start,
    stop,
    setVolume,
    setColor,
    setBinauralBeat,
  };
}
