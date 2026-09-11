export type VisualizerMode = "spectrum" | "waveform" | "circular" | "waterfall";

export const VISUALIZER_MODES: { id: VisualizerMode; label: string }[] = [
  { id: "spectrum", label: "Spectrum" },
  { id: "waveform", label: "Scope" },
  { id: "circular", label: "Vortex" },
  { id: "waterfall", label: "Waterfall" },
];

type Rgb = [number, number, number];

const ACCENT: Rgb = [56, 208, 255];
const ACCENT_2: Rgb = [149, 122, 255];
const WARM: Rgb = [255, 176, 82];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const rgba = (c: Rgb, alpha = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

/**
 * Sizes the canvas backing store to the element's real pixel dimensions.
 * Without this every line renders soft on a HiDPI display.
 */
function syncCanvasSize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): {
  width: number;
  height: number;
} {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = canvas.clientWidth || 600;
  const cssHeight = canvas.clientHeight || 240;
  const targetW = Math.floor(cssWidth * dpr);
  const targetH = Math.floor(cssHeight * dpr);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: cssWidth, height: cssHeight };
}

/**
 * Starts a render loop against the analyser. Returns a cleanup function.
 *
 * The mode is read through a getter on every frame so switching visualisations
 * does not tear down and rebuild the loop (which previously dropped a frame and
 * reset the waterfall history).
 */
export function startVisualizer(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  getMode: () => VisualizerMode
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let rafId = 0;
  let running = true;

  const binCount = analyser.frequencyBinCount;
  const freqData = new Uint8Array(binCount);
  const timeData = new Uint8Array(binCount);

  // Smoothed bar heights, so the spectrum falls away rather than flickering.
  const BARS = 72;
  const barLevels = new Float32Array(BARS);
  const peakLevels = new Float32Array(BARS);

  // Waterfall history buffer, drawn as an offscreen strip that scrolls up.
  let waterfall: HTMLCanvasElement | null = null;
  let waterfallCtx: CanvasRenderingContext2D | null = null;

  const sampleRate = analyser.context.sampleRate;
  const nyquist = sampleRate / 2;
  const minF = 30;
  const maxF = Math.min(18000, nyquist);
  const logMin = Math.log10(minF);
  const logMax = Math.log10(maxF);

  /** Average magnitude across a log-spaced slice of the FFT. */
  const logBandValue = (index: number, total: number): number => {
    const f0 = Math.pow(10, logMin + ((logMax - logMin) * index) / total);
    const f1 = Math.pow(10, logMin + ((logMax - logMin) * (index + 1)) / total);
    const b0 = Math.max(0, Math.floor((f0 / nyquist) * binCount));
    const b1 = Math.min(binCount - 1, Math.ceil((f1 / nyquist) * binCount));

    let sum = 0;
    let count = 0;
    for (let b = b0; b <= b1; b++) {
      sum += freqData[b];
      count++;
    }
    return count ? sum / count / 255 : 0;
  };

  const bassEnergy = (): number => {
    let sum = 0;
    const limit = Math.max(1, Math.floor((160 / nyquist) * binCount));
    for (let i = 0; i < limit; i++) sum += freqData[i];
    return sum / limit / 255;
  };

  const drawSpectrum = (width: number, height: number) => {
    analyser.getByteFrequencyData(freqData);
    const bass = bassEnergy();
    const hot = mix(ACCENT, WARM, Math.min(1, bass * 1.4));

    const slot = width / BARS;
    const barWidth = slot * 0.62;
    const floorY = height - 14;

    // Baseline
    ctx.fillStyle = rgba([255, 255, 255], 0.06);
    ctx.fillRect(0, floorY, width, 1);

    for (let i = 0; i < BARS; i++) {
      const target = logBandValue(i, BARS);
      // Fast attack, slow release — reads as a meter rather than noise.
      barLevels[i] = target > barLevels[i]
        ? target
        : barLevels[i] + (target - barLevels[i]) * 0.18;

      peakLevels[i] = Math.max(barLevels[i], peakLevels[i] - 0.006);

      const level = barLevels[i];
      const barHeight = Math.max(1, level * floorY * 0.94);
      const x = i * slot + (slot - barWidth) / 2;
      const y = floorY - barHeight;

      const tint = mix(hot, ACCENT_2, i / BARS);
      const gradient = ctx.createLinearGradient(0, floorY, 0, y);
      gradient.addColorStop(0, rgba(tint, 0.18));
      gradient.addColorStop(1, rgba(tint, 0.95));
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Falling peak marker
      const peakY = floorY - Math.max(1, peakLevels[i] * floorY * 0.94);
      ctx.fillStyle = rgba([255, 255, 255], 0.7);
      ctx.fillRect(x, peakY - 1.5, barWidth, 1.5);
    }

    // Log frequency ruler
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillStyle = rgba([255, 255, 255], 0.28);
    ctx.textAlign = "center";
    for (const f of [60, 200, 600, 2000, 6000, 15000]) {
      const t = (Math.log10(f) - logMin) / (logMax - logMin);
      if (t < 0 || t > 1) continue;
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, t * width, height - 3);
    }
  };

  const drawWaveform = (width: number, height: number) => {
    analyser.getByteTimeDomainData(timeData);
    const mid = height / 2;

    ctx.strokeStyle = rgba([255, 255, 255], 0.07);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();

    const step = width / timeData.length;

    // Glow pass, then a crisp pass on top.
    for (const pass of [
      { width: 5, alpha: 0.16 },
      { width: 1.6, alpha: 0.95 },
    ]) {
      ctx.beginPath();
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        const y = mid + v * mid * 0.92;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.lineWidth = pass.width;
      ctx.strokeStyle = rgba(ACCENT, pass.alpha);
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  };

  const drawCircular = (width: number, height: number) => {
    analyser.getByteFrequencyData(freqData);
    const cx = width / 2;
    const cy = height / 2;
    const bass = bassEnergy();
    const radius = Math.min(cx, cy) * (0.42 + bass * 0.06);
    const spokes = 96;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(ACCENT, 0.18 + bass * 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();

    for (let i = 0; i < spokes; i++) {
      const level = logBandValue(i, spokes);
      const length = Math.max(1.5, level * radius * 1.15);
      const angle = (i / spokes) * Math.PI * 2 - Math.PI / 2;
      const tint = mix(mix(ACCENT, WARM, bass), ACCENT_2, i / spokes);

      ctx.save();
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(radius, 0, radius + length, 0);
      gradient.addColorStop(0, rgba(tint, 0.9));
      gradient.addColorStop(1, rgba(tint, 0.05));
      ctx.fillStyle = gradient;
      ctx.fillRect(radius, -1.4, length, 2.8);
      ctx.restore();
    }

    // Bass-reactive core
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.9);
    core.addColorStop(0, rgba(mix(ACCENT, WARM, bass), 0.22 * bass + 0.03));
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawWaterfall = (width: number, height: number) => {
    analyser.getByteFrequencyData(freqData);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(width * dpr);
    const h = Math.floor(height * dpr);

    if (!waterfall || waterfall.width !== w || waterfall.height !== h) {
      waterfall = document.createElement("canvas");
      waterfall.width = w;
      waterfall.height = h;
      waterfallCtx = waterfall.getContext("2d");
      if (waterfallCtx) {
        waterfallCtx.fillStyle = "#05060a";
        waterfallCtx.fillRect(0, 0, w, h);
      }
    }
    if (!waterfallCtx || !waterfall) return;

    // Scroll the existing image up by one row, then paint the newest row.
    waterfallCtx.drawImage(waterfall, 0, -1);

    const columns = Math.min(w, 320);
    const colWidth = w / columns;
    for (let i = 0; i < columns; i++) {
      const level = logBandValue(i, columns);
      const tint = level < 0.5
        ? mix([12, 16, 30], ACCENT, level * 2)
        : mix(ACCENT, WARM, (level - 0.5) * 2);
      waterfallCtx.fillStyle = rgba(tint, 0.25 + level * 0.75);
      waterfallCtx.fillRect(i * colWidth, h - 1, colWidth + 1, 1);
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(waterfall, 0, 0);
    ctx.restore();
  };

  const frame = () => {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    const { width, height } = syncCanvasSize(canvas, ctx);
    ctx.clearRect(0, 0, width, height);

    switch (getMode()) {
      case "waveform": drawWaveform(width, height); break;
      case "circular": drawCircular(width, height); break;
      case "waterfall": drawWaterfall(width, height); break;
      default: drawSpectrum(width, height);
    }
  };

  frame();

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
  };
}
