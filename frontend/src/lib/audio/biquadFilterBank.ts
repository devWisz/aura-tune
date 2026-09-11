// 10-Band Parametric Equalizer Frequencies (Hz)
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export type EQGainMap = Record<number, number>;

export interface FilterNodeBank {
  filters: BiquadFilterNode[];
  setGain: (freqIndex: number, gainDb: number) => void;
  setAllGains: (gains: number[]) => void;
  getGains: () => number[];
}

export function createBiquadFilterBank(audioCtx: AudioContext): FilterNodeBank {
  const filters: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, index) => {
    const filter = audioCtx.createBiquadFilter();
    filter.frequency.value = freq;
    filter.gain.value = 0; // Default flat 0 dB

    if (index === 0) {
      filter.type = "lowshelf";
    } else if (index === EQ_FREQUENCIES.length - 1) {
      filter.type = "highshelf";
    } else {
      filter.type = "peaking";
      filter.Q.value = 1.41; // Standard Q factor for 10-band EQ
    }
    return filter;
  });

  // Chain filters sequentially: filter[0] -> filter[1] -> ... -> filter[9]
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }

  const setGain = (freqIndex: number, gainDb: number) => {
    if (filters[freqIndex]) {
      // Smooth parameter transition over 0.05 seconds to avoid audio clicks
      filters[freqIndex].gain.setTargetAtTime(gainDb, audioCtx.currentTime, 0.015);
    }
  };

  const setAllGains = (gains: number[]) => {
    gains.forEach((gain, i) => setGain(i, gain));
  };

  const getGains = () => filters.map((f) => f.gain.value);

  return {
    filters,
    setGain,
    setAllGains,
    getGains,
  };
}
