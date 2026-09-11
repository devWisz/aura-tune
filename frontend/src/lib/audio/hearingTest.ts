import { EQ_FREQUENCIES } from "./biquadFilterBank";

/** Audiometric frequencies, ordered the way the wizard presents them. */
export const TEST_FREQUENCIES = [125, 250, 500, 1000, 2000, 4000, 8000, 12000];

export type TestEar = "left" | "right";

/** Steps are 5 dB apart; step 0 is the loudest presentation. */
export const TOTAL_STEPS = 13;
const TOP_LEVEL_DBFS = -22;
const STEP_DB = 5;

export interface TestStep {
  frequency: number;
  ear: TestEar;
}

export interface Audiogram {
  /** Threshold step index per ear, indexed like TEST_FREQUENCIES. */
  left: number[];
  right: number[];
  createdAt: number;
}

/** Every frequency is tested in both ears, left first. */
export function buildTestPlan(): TestStep[] {
  const plan: TestStep[] = [];
  for (const ear of ["left", "right"] as TestEar[]) {
    for (const frequency of TEST_FREQUENCIES) plan.push({ frequency, ear });
  }
  return plan;
}

/** Linear amplitude for a step index, with equal-loudness weighting applied. */
export function stepToAmplitude(step: number, frequency: number): number {
  const dbfs = TOP_LEVEL_DBFS - step * STEP_DB;
  // The ear is far less sensitive at the extremes; without this weighting the
  // very low and very high tones would appear as hearing loss in everyone.
  const weight = equalLoudnessOffsetDb(frequency);
  return Math.min(0.5, Math.pow(10, (dbfs + weight) / 20));
}

/**
 * Rough inverse of the ISO 226 equal-loudness contour at conversational level,
 * expressed as the extra dB needed for a tone to sound as loud as 1 kHz.
 */
function equalLoudnessOffsetDb(frequency: number): number {
  const points: [number, number][] = [
    [125, 12], [250, 6], [500, 2], [1000, 0],
    [2000, -1], [4000, -2], [8000, 6], [12000, 14],
  ];
  if (frequency <= points[0][0]) return points[0][1];
  if (frequency >= points[points.length - 1][0]) return points[points.length - 1][1];

  for (let i = 0; i < points.length - 1; i++) {
    const [f0, v0] = points[i];
    const [f1, v1] = points[i + 1];
    if (frequency >= f0 && frequency <= f1) {
      const t = (Math.log2(frequency) - Math.log2(f0)) / (Math.log2(f1) - Math.log2(f0));
      return v0 + (v1 - v0) * t;
    }
  }
  return 0;
}

export function emptyAudiogram(): Audiogram {
  return {
    left: new Array(TEST_FREQUENCIES.length).fill(-1),
    right: new Array(TEST_FREQUENCIES.length).fill(-1),
    createdAt: Date.now(),
  };
}

export function isAudiogramComplete(audiogram: Audiogram): boolean {
  return [...audiogram.left, ...audiogram.right].every((v) => v >= 0);
}

/**
 * Turns thresholds into a compensation curve.
 *
 * The most sensitive band becomes the reference; any band the listener needed
 * louder is boosted by the difference. Boosts are damped to 60% and capped,
 * because a literal inverse of a rough at-home test would be both fatiguing and
 * a good way to clip the output.
 */
export function audiogramToEQGains(audiogram: Audiogram): number[] {
  const perFrequency = TEST_FREQUENCIES.map((_, i) => {
    const left = audiogram.left[i];
    const right = audiogram.right[i];
    const valid = [left, right].filter((v) => v >= 0);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  });

  const measured = perFrequency.filter((v): v is number => v !== null);
  if (measured.length === 0) return new Array(EQ_FREQUENCIES.length).fill(0);

  // A higher step index means the listener heard it at a quieter level, i.e.
  // better hearing. The best band is the reference.
  const best = Math.max(...measured);

  const lossDb = perFrequency.map((v) => (v === null ? 0 : (best - v) * STEP_DB));

  return EQ_FREQUENCIES.map((bandFreq) => {
    const raw = interpolateAtFrequency(TEST_FREQUENCIES, lossDb, bandFreq);
    return Math.round(Math.max(0, Math.min(12, raw * 0.6)) * 2) / 2;
  });
}

/** Per-ear balance in the range −1 … 1, from the asymmetry between ears. */
export function audiogramToBalance(audiogram: Audiogram): number {
  const avg = (arr: number[]) => {
    const valid = arr.filter((v) => v >= 0);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  };
  const left = avg(audiogram.left);
  const right = avg(audiogram.right);
  // A weaker ear (lower step count) gets nudged louder; ±0.3 is plenty.
  const delta = (right - left) * STEP_DB;
  return Math.max(-0.3, Math.min(0.3, delta / 40));
}

/** Log-frequency linear interpolation, clamped at both ends. */
function interpolateAtFrequency(freqs: number[], values: number[], target: number): number {
  if (target <= freqs[0]) return values[0];
  if (target >= freqs[freqs.length - 1]) return values[values.length - 1];

  for (let i = 0; i < freqs.length - 1; i++) {
    if (target >= freqs[i] && target <= freqs[i + 1]) {
      const t =
        (Math.log2(target) - Math.log2(freqs[i])) /
        (Math.log2(freqs[i + 1]) - Math.log2(freqs[i]));
      return values[i] + (values[i + 1] - values[i]) * t;
    }
  }
  return 0;
}

/** Human-readable summary of the result, for the report card. */
export function describeAudiogram(audiogram: Audiogram): string {
  const gains = audiogramToEQGains(audiogram);
  const maxBoost = Math.max(...gains);
  const peakBand = EQ_FREQUENCIES[gains.indexOf(maxBoost)];

  if (maxBoost < 1.5) return "Even response across all bands — no correction needed.";
  const where = peakBand >= 1000 ? `${peakBand / 1000} kHz` : `${peakBand} Hz`;
  if (maxBoost < 4) return `Mild roll-off around ${where}; a gentle lift applied.`;
  return `Reduced sensitivity around ${where}; up to +${maxBoost.toFixed(1)} dB applied.`;
}
