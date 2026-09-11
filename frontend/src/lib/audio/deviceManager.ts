/**
 * Output device discovery and routing.
 *
 * This is what actually "connects your headphones": `AudioContext.setSinkId()`
 * re-targets the rendered DSP output at a specific system output device, so the
 * equalised signal lands on the headphones rather than the laptop speakers.
 *
 * Note on Bluetooth: Web Bluetooth (`navigator.bluetooth`) speaks BLE GATT only
 * and CANNOT carry audio — A2DP streaming is owned by the operating system. A
 * Bluetooth headset is paired in OS settings, at which point it shows up here as
 * an ordinary `audiooutput` device. Web Bluetooth is therefore used purely for
 * side-channel telemetry (battery level), never for the audio path itself.
 */

export type DeviceKind = "bluetooth" | "airpods" | "usb" | "wired" | "builtin" | "unknown";

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
  groupId: string;
  kind: DeviceKind;
  isDefault: boolean;
  /** True when the label looks like headphones rather than speakers. */
  isHeadphone: boolean;
}

export interface DeviceSupport {
  /** `enumerateDevices` exists (all modern browsers). */
  canEnumerate: boolean;
  /** `AudioContext.setSinkId` exists — required to re-route the DSP chain. */
  canRoute: boolean;
  /** `navigator.mediaDevices.selectAudioOutput` exists — native device picker. */
  canPick: boolean;
  /** `navigator.bluetooth` exists — BLE telemetry only. */
  canBluetooth: boolean;
}

export function getDeviceSupport(): DeviceSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { canEnumerate: false, canRoute: false, canPick: false, canBluetooth: false };
  }
  return {
    canEnumerate: !!navigator.mediaDevices?.enumerateDevices,
    canRoute:
      typeof AudioContext !== "undefined" &&
      typeof (AudioContext.prototype as AudioContext).setSinkId === "function",
    canPick: !!navigator.mediaDevices?.selectAudioOutput,
    canBluetooth: !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth,
  };
}

const BLUETOOTH_HINTS = ["bluetooth", "bt ", "wireless", "jbl", "sony wh", "wh-1000", "bose", "buds", "beats", "soundcore", "galaxy"];
const USB_HINTS = ["usb", "dac", "scarlett", "audient", "focusrite", "fiio", "dragonfly"];
const WIRED_HINTS = ["headphone", "headset", "external headphones", "3.5", "line out"];
const BUILTIN_HINTS = ["built-in", "internal", "macbook", "speakers", "display audio", "imac"];

/** Best-effort classification of a device from its (often messy) label. */
export function classifyDevice(label: string): DeviceKind {
  const l = label.toLowerCase();
  if (l.includes("airpod")) return "airpods";
  if (BLUETOOTH_HINTS.some((h) => l.includes(h))) return "bluetooth";
  if (USB_HINTS.some((h) => l.includes(h))) return "usb";
  if (BUILTIN_HINTS.some((h) => l.includes(h))) return "builtin";
  if (WIRED_HINTS.some((h) => l.includes(h))) return "wired";
  return "unknown";
}

function looksLikeHeadphone(label: string, kind: DeviceKind): boolean {
  const l = label.toLowerCase();
  if (kind === "airpods" || kind === "bluetooth" || kind === "wired") return true;
  return /head(phone|set)|earbud|buds|iem/.test(l);
}

/**
 * Enumerate audio output devices.
 *
 * Labels are blank until the page holds a media permission, so the caller is
 * expected to check `labelsHidden` and offer `requestDeviceLabels()`.
 */
export async function listOutputDevices(): Promise<{
  devices: AudioOutputDevice[];
  labelsHidden: boolean;
}> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { devices: [], labelsHidden: false };
  }

  const all = await navigator.mediaDevices.enumerateDevices();
  const outputs = all.filter((d) => d.kind === "audiooutput");
  const labelsHidden = outputs.length > 0 && outputs.every((d) => !d.label);

  const devices = outputs.map((d, i) => {
    const isDefault = d.deviceId === "default" || d.deviceId === "";
    const label = d.label || (isDefault ? "System default output" : `Output device ${i + 1}`);
    const kind = classifyDevice(label);
    return {
      deviceId: d.deviceId || "default",
      label: label.replace(/^Default\s*-\s*/i, ""),
      groupId: d.groupId,
      kind,
      isDefault,
      isHeadphone: looksLikeHeadphone(label, kind),
    };
  });

  // Deduplicate: Chrome lists the same physical device as both "default" and
  // its own id. Keep both but make sure "default" sorts first.
  devices.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return { devices, labelsHidden };
}

/**
 * Device labels are privacy-gated behind a media permission. A one-shot mic
 * grant is the standard way to unlock them; the track is stopped immediately so
 * nothing is recorded and the mic indicator clears.
 */
export async function requestDeviceLabels(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

/** Opens Chrome's native output picker; returns the chosen device id. */
export async function pickOutputDevice(): Promise<AudioOutputDevice | null> {
  if (!navigator.mediaDevices?.selectAudioOutput) return null;
  try {
    const info = await navigator.mediaDevices.selectAudioOutput();
    const kind = classifyDevice(info.label);
    return {
      deviceId: info.deviceId,
      label: info.label || "Selected output",
      groupId: info.groupId,
      kind,
      isDefault: info.deviceId === "default",
      isHeadphone: looksLikeHeadphone(info.label, kind),
    };
  } catch {
    return null;
  }
}

/** Subscribes to hot-plug events (headphones connected / removed). */
export function onDeviceChange(handler: () => void): () => void {
  if (!navigator.mediaDevices?.addEventListener) return () => {};
  navigator.mediaDevices.addEventListener("devicechange", handler);
  return () => navigator.mediaDevices.removeEventListener("devicechange", handler);
}

/* ------------------------------------------------------------------ *
 * Web Bluetooth — BLE telemetry only (battery level), not the audio path.
 *
 * Worth attempting on the Tune 730BT specifically: it is a Bluetooth 6.0 /
 * LE Audio headphone, so unlike older classic-only headsets it does advertise
 * over BLE and can expose the standard GATT battery service. Older JBL Tune
 * models generally will not answer, which is why every failure below is
 * reported honestly rather than smoothed over with a fake number.
 * ------------------------------------------------------------------ */

export interface BluetoothTelemetry {
  deviceName: string;
  battery: number | null;
  /** True when the GATT battery service answered; false when it is unavailable. */
  batterySupported: boolean;
}

export interface BluetoothSession extends BluetoothTelemetry {
  disconnect: () => void;
}

/** Why a link attempt produced no telemetry — drives the guidance we show. */
export type BluetoothFailure =
  | "unsupported"
  | "cancelled"
  | "no-gatt"
  | "no-battery-service"
  | "connect-failed";

export class BluetoothLinkError extends Error {
  constructor(public reason: BluetoothFailure, message: string) {
    super(message);
    this.name = "BluetoothLinkError";
  }
}

/**
 * Scan for a BLE device.
 *
 * `jblOnly` narrows the chooser to JBL-branded advertisers, which is the fast
 * path for the house headphone; the broad scan stays available because some
 * stacks advertise the 730BT under a bare MAC-derived name.
 */
export async function connectBluetoothTelemetry(opts: {
  jblOnly?: boolean;
  onBattery: (level: number) => void;
  onDisconnect: () => void;
}): Promise<BluetoothSession> {
  const bt = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;
  if (!bt) {
    throw new BluetoothLinkError("unsupported", "Web Bluetooth is unavailable in this browser.");
  }

  let device: BluetoothDevice;
  try {
    device = await bt.requestDevice(
      opts.jblOnly
        ? {
            filters: [{ namePrefix: "JBL" }, { namePrefix: "Tune" }],
            optionalServices: ["battery_service", "device_information"],
          }
        : {
            acceptAllDevices: true,
            optionalServices: ["battery_service", "device_information"],
          }
    );
  } catch {
    // The chooser was dismissed, or nothing matched the filter.
    throw new BluetoothLinkError("cancelled", "No device was selected.");
  }

  const deviceName = device.name || "Bluetooth device";

  if (!device.gatt) {
    throw new BluetoothLinkError(
      "no-gatt",
      `${deviceName} does not expose a GATT server to the browser.`
    );
  }

  let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  const handleBatteryChange = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (target.value) opts.onBattery(target.value.getUint8(0));
  };

  device.addEventListener("gattserverdisconnected", opts.onDisconnect);

  const teardown = () => {
    try {
      characteristic?.removeEventListener("characteristicvaluechanged", handleBatteryChange);
      device.removeEventListener("gattserverdisconnected", opts.onDisconnect);
      device.gatt?.disconnect();
    } catch {
      /* already gone */
    }
  };

  let server: BluetoothRemoteGATTServer;
  try {
    server = await device.gatt.connect();
  } catch {
    teardown();
    throw new BluetoothLinkError(
      "connect-failed",
      `Could not open a GATT connection to ${deviceName}.`
    );
  }

  let battery: number | null = null;
  try {
    const service = await server.getPrimaryService("battery_service");
    characteristic = await service.getCharacteristic("battery_level");
    battery = (await characteristic.readValue()).getUint8(0);

    // Push updates as the device reports them, if it supports notifications.
    try {
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleBatteryChange);
    } catch {
      /* Notifications are optional; the one-shot read above still stands. */
    }
  } catch {
    // Linked, but the headphone keeps battery on a vendor-private service.
    return { deviceName, battery: null, batterySupported: false, disconnect: teardown };
  }

  return { deviceName, battery, batterySupported: true, disconnect: teardown };
}
