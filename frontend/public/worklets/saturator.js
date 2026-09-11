/**
 * AuraTune tube saturator — runs off the main thread on the audio render thread.
 *
 * Models the asymmetric soft clipping of a valve stage: a small amount of even
 * harmonic content (the "warmth"), a tanh-shaped knee, and an output trim that
 * compensates for the gain the drive stage adds so A/B comparisons stay level.
 */
class SaturatorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "drive",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "warmth",
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    // One-pole DC blockers, one per channel, to remove the offset that
    // asymmetric clipping introduces.
    this._dcX = [0, 0];
    this._dcY = [0, 0];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const drive = parameters.drive[0];
    const warmth = parameters.warmth[0];

    // Bypass cleanly at zero drive rather than burning cycles on a no-op curve.
    if (drive <= 0.0001) {
      for (let c = 0; c < input.length; c++) {
        if (output[c] && input[c]) output[c].set(input[c]);
      }
      return true;
    }

    const preGain = 1 + drive * 9;          // up to +20 dB into the stage
    const makeup = 1 / (1 + drive * 2.2);   // trim back toward unity
    const asym = warmth * 0.25;             // even-harmonic bias

    for (let c = 0; c < input.length; c++) {
      const inCh = input[c];
      const outCh = output[c];
      if (!inCh || !outCh) continue;

      let x1 = this._dcX[c] || 0;
      let y1 = this._dcY[c] || 0;

      for (let i = 0; i < inCh.length; i++) {
        const x = inCh[i] * preGain + asym;
        // tanh approximation: cheaper than Math.tanh and audibly equivalent here
        const x2 = x * x;
        const shaped = x * (27 + x2) / (27 + 9 * x2);
        const clipped = shaped > 1 ? 1 : shaped < -1 ? -1 : shaped;

        // DC blocker: y[n] = x[n] - x[n-1] + 0.9975 * y[n-1]
        const y = clipped - x1 + 0.9975 * y1;
        x1 = clipped;
        y1 = y;

        outCh[i] = y * makeup;
      }

      this._dcX[c] = x1;
      this._dcY[c] = y1;
    }

    return true;
  }
}

registerProcessor("tube-saturator", SaturatorProcessor);
