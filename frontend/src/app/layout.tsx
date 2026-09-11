import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuraTune — JBL Tune 730BT DSP Studio",
  description:
    "A browser audio studio tuned for the JBL Tune 730BT: a correction EQ for its Pure Bass curve, crossfeed, saturation, output routing, battery telemetry over BLE, a hearing-profile test and procedural masking noise for a headphone with no ANC.",
};

export const viewport: Viewport = {
  themeColor: "#08090d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-accent/30 selection:text-white">{children}</body>
    </html>
  );
}
