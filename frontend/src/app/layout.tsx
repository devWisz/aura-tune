import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuraTune DSP Web Studio | Professional Headphone Equalizer & Audio Engine",
  description:
    "High-performance Web Audio DSP dashboard with 10-band parametric EQ, software noise masking, 3D spatialization, Web Bluetooth telemetry, and Ruby API cloud preset sync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-studio-bg text-slate-100 selection:bg-cyan-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
