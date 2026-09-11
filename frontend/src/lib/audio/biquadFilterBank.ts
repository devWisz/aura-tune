/** 10-band graphic EQ on ISO-ish octave centres. */
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_MIN_DB = -18;

/**
 * The exact Float32Array flavour `getFrequencyResponse` expects. Deriving it
 * from the DOM signature keeps this compiling across TypeScript versions, which
 * disagree on whether Float32Array carries an ArrayBuffer type parameter.
 */
export type ResponseArray = Parameters<BiquadFilterNode["getFrequencyResponse"]>[0];
export const EQ_MAX_DB = 18;

export interface FilterNodeBank {
  filters: BiquadFilterNode[];
  input: BiquadFilterNode;
  output: BiquadFilterNode;
  setGain: (freqIndex: number, gainDb: number) => void;
  setAllGains: (gains: number[]) => void;
  setQ: (q: number) => void;
  getGains: () => number[];
  /** Combined magnitude response of the whole chain, in dB. */
  getResponseCurve: (frequencies: ResponseArray) => Float32Array;
}

export function createBiquadFilterBank(audioCtx: AudioContext, q = 1.41): FilterNodeBank {
  const filters: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, index) => {
    const filter = audioCtx.createBiquadFilter();
    filter.frequency.value = freq;
    filter.gain.value = 0;

    if (index === 0) {
      filter.type = "lowshelf";
    } else if (index === EQ_FREQUENCIES.length - 1) {
      filter.type = "highshelf";
    } else {
      filter.type = "peaking";
      filter.Q.value = q;
    }
    return filter;
  });

  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }

  const setGain = (freqIndex: number, gainDb: number) => {
    const filter = filters[freqIndex];
    if (!filter) return;
    const clamped = Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, gainDb));
    // Ramp rather than jump, so dragging a fader does not click.
    filter.gain.setTargetAtTime(clamped, audioCtx.currentTime, 0.015);
  };

  const setAllGains = (gains: number[]) => gains.forEach((gain, i) => setGain(i, gain));

  const setQ = (nextQ: number) => {
    filters.forEach((filter, i) => {
      if (i === 0 || i === filters.length - 1) return;
      filter.Q.setTargetAtTime(nextQ, audioCtx.currentTime, 0.02);
    });
  };

  const getResponseCurve = (frequencies: ResponseArray): Float32Array => {
    const total = new Float32Array(frequencies.length).fill(0);
    const mag = new Float32Array(frequencies.length) as ResponseArray;
    const phase = new Float32Array(frequencies.length) as ResponseArray;

    for (const filter of filters) {
      filter.getFrequencyResponse(frequencies, mag, phase);
      for (let i = 0; i < frequencies.length; i++) {
        // Cascaded filters multiply in magnitude, i.e. add in dB.
        total[i] += 20 * Math.log10(Math.max(mag[i], 1e-6));
      }
    }
    return total;
  };

  return {
    filters,
    input: filters[0],
    output: filters[filters.length - 1],
    setGain,
    setAllGains,
    setQ,
    getGains: () => filters.map((f) => f.gain.value),
    getResponseCurve,
  };
}

/**
 * Analytic fallback curve for when no AudioContext exists yet (first paint,
 * before the user has interacted). Approximates each band as a Gaussian bump in
 * log-frequency so the displayed curve matches what the filters will do.
 */
export function approximateResponseCurve(gains: number[], frequencies: ResponseArray): Float32Array {
  const out = new Float32Array(frequencies.length);
  const octaveWidth = 0.62;

  for (let i = 0; i < frequencies.length; i++) {
    const logF = Math.log2(frequencies[i]);
    let sum = 0;

    for (let b = 0; b < EQ_FREQUENCIES.length; b++) {
      const gain = gains[b] ?? 0;
      if (gain === 0) continue;
      const delta = logF - Math.log2(EQ_FREQUENCIES[b]);

      if (b === 0 && delta < 0) sum += gain;
      else if (b === EQ_FREQUENCIES.length - 1 && delta > 0) sum += gain;
      else sum += gain * Math.exp(-(delta * delta) / (2 * octaveWidth * octaveWidth));
    }
    out[i] = sum;
  }
  return out;
}
