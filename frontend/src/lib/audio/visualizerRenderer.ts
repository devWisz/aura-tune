export type VisualizerMode = "spectrum" | "waveform" | "circular";

export function drawSpectrumVisualizer(
  canvas: HTMLCanvasElement,
  analyserNode: AnalyserNode,
  mode: VisualizerMode = "spectrum"
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let animationFrameId: number;
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const render = () => {
    animationFrameId = requestAnimationFrame(render);

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (mode === "spectrum") {
      analyserNode.getByteFrequencyData(dataArray);
      const barCount = 48; // Crisp, spacious bars
      const barWidth = (width / barCount) * 0.7;
      const barSpacing = (width / barCount) * 0.3;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step];
        const percent = value / 255;
        const barHeight = percent * height * 0.85;
        const x = i * (barWidth + barSpacing);
        const y = height - barHeight;

        // Clean monochrome gradient: Pure white to subtle zinc
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
        gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.65)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0.95)");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Minimalist top cap line
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, Math.max(0, y - 2), barWidth, 1.5);
      }
    } else if (mode === "waveform") {
      analyserNode.getByteTimeDomainData(dataArray);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    } else if (mode === "circular") {
      analyserNode.getByteFrequencyData(dataArray);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) * 0.4;
      const barCount = 48;
      const step = Math.floor(bufferLength / barCount);

      ctx.save();
      ctx.translate(centerX, centerY);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step];
        const barHeight = (value / 255) * (radius * 0.7);
        const angle = (i * 2 * Math.PI) / barCount;

        ctx.rotate(angle);
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.fillRect(-1.5, radius, 3, barHeight);
        ctx.rotate(-angle);
      }

      // Inner subtle circle
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }
  };

  render();

  return () => {
    cancelAnimationFrame(animationFrameId);
  };
}
