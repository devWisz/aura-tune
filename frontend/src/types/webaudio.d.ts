// Ambient declarations for Web Audio / Media Devices APIs that ship in Chromium
// but are not yet part of the bundled TypeScript DOM lib.

interface AudioContext {
  /** Chrome 110+. Routes the context's rendered output to a specific device. */
  setSinkId?: (sinkId: string | { type: "none" }) => Promise<void>;
  /** The device the context is currently rendering to ("" === system default). */
  readonly sinkId?: string | { type: "none" };
}

interface AudioContextOptions {
  sinkId?: string | { type: "none" };
}

interface MediaDevices {
  /** Chrome 105+. Shows the browser's own output-device picker. */
  selectAudioOutput?: (options?: { deviceId?: string }) => Promise<MediaDeviceInfo>;
}

interface HTMLMediaElement {
  setSinkId?: (sinkId: string) => Promise<void>;
  readonly sinkId?: string;
}

interface Navigator {
  readonly userAgentData?: {
    readonly brands: { brand: string; version: string }[];
    readonly mobile: boolean;
    readonly platform: string;
  };
}
