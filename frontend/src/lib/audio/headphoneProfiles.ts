/**
 * Headphone correction profiles.
 *
 * This build is tuned around the **JBL Tune 730BT**, so that model carries full
 * hardware metadata and a hand-built correction curve; the remaining entries are
 * fallbacks so the studio still behaves sensibly on other hardware.
 *
 * Gains are in dB across the ten EQ bands defined in `biquadFilterBank.ts`
 * (31 / 62 / 125 / 250 / 500 / 1k / 2k / 4k / 8k / 16k Hz). They are a rough
 * inverse of each model's published deviation from a neutral target — a sane
 * starting point, not a measurement-grade correction.
 */

export interface HeadphoneSpecs {
  driverMm: number;
  impedanceOhms: number;
  /** Rated response, in Hz. */
  freqLow: number;
  freqHigh: number;
  weightGrams: number;
  bluetooth: string;
  codecs: string[];
  /** Active noise cancelling. The Tune 730BT is passive-isolation only. */
  anc: boolean;
  batteryHours: number;
  quickCharge: string | null;
  multipoint: boolean;
}

export interface HeadphoneProfile {
  id: string;
  brand: string;
  model: string;
  /** Lowercase fragments matched against the OS output-device label. */
  match: string[];
  eqGains: number[];
  crossfeed: number;
  /** Make-up gain for the profile, in dB — negative curves can afford a lift. */
  preampDb: number;
  notes: string;
  /** Only the house model carries a full spec sheet. */
  specs?: HeadphoneSpecs;
}

/** The model this build is tuned for. */
export const PRIMARY_PROFILE_ID = "jbl-tune-730bt";

export const HEADPHONE_PROFILES: HeadphoneProfile[] = [
  {
    id: PRIMARY_PROFILE_ID,
    brand: "JBL",
    model: "Tune 730BT",
    // "tune 730" is the reliable hit; JBL's own firmware reports the device as
    // "JBL Tune 730BT", but some stacks truncate or drop the space.
    match: ["tune 730", "tune730", "jbl tune 730", "t730"],
    eqGains: [-3, -5, -4, -1.5, 0.5, 1.5, 2.5, 1, -2.5, 1.5],
    crossfeed: 0.28,
    preampDb: 2,
    notes:
      "Neutralises the Pure Bass shelf, recovers the scooped mids and takes the edge off the 8 kHz peak.",
    specs: {
      driverMm: 40,
      impedanceOhms: 32,
      freqLow: 20,
      freqHigh: 20000,
      weightGrams: 218,
      bluetooth: "6.0 / LE Audio",
      codecs: ["SBC", "AAC", "LC3"],
      anc: false,
      batteryHours: 76,
      quickCharge: "5 min → 5 h",
      multipoint: true,
    },
  },
  {
    id: "jbl-tune-7xx",
    brand: "JBL",
    model: "Tune 720 / 760NC / 770NC",
    match: ["tune 720", "tune 760", "tune 770", "jbl tune"],
    eqGains: [-2, -4, -3.5, -1.5, 0.5, 1.5, 2, 1, -2, 1],
    crossfeed: 0.25,
    preampDb: 1.5,
    notes: "Same Pure Bass house curve as the 730BT, with a slightly milder mid-bass cut.",
  },
  {
    id: "jbl-generic",
    brand: "JBL",
    model: "Tune / Live series",
    match: ["jbl"],
    eqGains: [-1.5, -3, -2.5, -1, 0.5, 1, 1.5, 1, -1.5, 0.5],
    crossfeed: 0.2,
    preampDb: 1.5,
    notes: "General JBL house-sound correction: less bass bloom, more clarity.",
  },
  {
    id: "sony-xm",
    brand: "Sony",
    model: "WH-1000XM4 / XM5",
    match: ["wh-1000", "wh1000", "sony wh", "xm4", "xm5"],
    eqGains: [1, 0.5, -1, -2, -1, 0, 1.5, 2, 1, -1],
    crossfeed: 0.25,
    preampDb: 0,
    notes: "Flattens the V-shaped default tuning toward Sony's own reference curve.",
  },
  {
    id: "airpods-max",
    brand: "Apple",
    model: "AirPods Max",
    match: ["airpods max"],
    eqGains: [1, 0.5, 0, -0.5, 0, 0.5, 1, 0.5, -1, -2],
    crossfeed: 0.15,
    preampDb: 0,
    notes: "Already close to neutral — a light touch plus treble smoothing.",
  },
  {
    id: "airpods-pro",
    brand: "Apple",
    model: "AirPods / AirPods Pro",
    match: ["airpod"],
    eqGains: [2, 1, -0.5, -1, -0.5, 0.5, 1.5, 1, -0.5, -1.5],
    crossfeed: 0.1,
    preampDb: 0,
    notes: "Adds sub-bass extension the small drivers roll off.",
  },
  {
    id: "sennheiser-hd6xx",
    brand: "Sennheiser",
    model: "HD 600 / HD 650",
    match: ["hd 600", "hd600", "hd 650", "hd650", "hd 6xx", "sennheiser"],
    eqGains: [4, 3, 1, 0, 0, 0, -1, 1, 2, 1],
    crossfeed: 0.35,
    preampDb: -3,
    notes: "Fills in the open-back sub-bass roll-off and lifts the 'veiled' treble.",
  },
  {
    id: "bose-qc",
    brand: "Bose",
    model: "QuietComfort series",
    match: ["bose", "quietcomfort", "qc35", "qc45"],
    eqGains: [1, 0.5, -0.5, -1, -0.5, 0.5, 1, 1.5, 0.5, -0.5],
    crossfeed: 0.2,
    preampDb: 0,
    notes: "Slight de-emphasis of the warm midbass, gentle presence lift.",
  },
  {
    id: "beats",
    brand: "Beats",
    model: "Studio / Solo",
    match: ["beats", "solo pro", "studio3"],
    eqGains: [-1, -2, -2.5, -1.5, 0, 1, 2, 2, 1, 0],
    crossfeed: 0.15,
    preampDb: 1,
    notes: "Pulls back the signature bass shelf for a more balanced mix.",
  },
  {
    id: "samsung-buds",
    brand: "Samsung",
    model: "Galaxy Buds",
    match: ["galaxy buds", "buds pro", "buds2"],
    eqGains: [2, 1, 0, -1, -1, 0, 1, 1.5, 1, 0],
    crossfeed: 0.1,
    preampDb: 0,
    notes: "Extends the low end and opens up the upper mids.",
  },
  {
    id: "generic-iem",
    brand: "Universal",
    model: "In-ear monitors",
    match: ["iem", "earbud", "earphone"],
    eqGains: [2, 1.5, 0.5, -0.5, -0.5, 0, 1, 1.5, 0.5, -0.5],
    crossfeed: 0.1,
    preampDb: 0,
    notes: "Mild Harman-style tilt that suits most in-ears.",
  },
];

export const PRIMARY_PROFILE: HeadphoneProfile = HEADPHONE_PROFILES.find(
  (p) => p.id === PRIMARY_PROFILE_ID
)!;

/** Finds the most specific profile whose match fragments appear in the label. */
export function matchHeadphoneProfile(label: string | null | undefined): HeadphoneProfile | null {
  if (!label) return null;
  const l = label.toLowerCase();
  let best: HeadphoneProfile | null = null;
  let bestLen = 0;

  for (const profile of HEADPHONE_PROFILES) {
    for (const fragment of profile.match) {
      if (l.includes(fragment) && fragment.length > bestLen) {
        best = profile;
        bestLen = fragment.length;
      }
    }
  }
  return best;
}

/** True when a device label looks like the model this build targets. */
export function isPrimaryHeadphone(label: string | null | undefined): boolean {
  return matchHeadphoneProfile(label)?.id === PRIMARY_PROFILE_ID;
}
