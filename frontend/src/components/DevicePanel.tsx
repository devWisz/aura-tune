"use client";

import React, { useEffect } from "react";
import {
  BatteryFull,
  Bluetooth,
  BluetoothConnected,
  Cable,
  Check,
  ChevronDown,
  Headphones,
  Info,
  Loader2,
  MonitorSpeaker,
  RefreshCw,
  Speaker,
  Usb,
  Wand2,
} from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { onDeviceChange, DeviceKind } from "@/lib/audio/deviceManager";
import { PRIMARY_PROFILE } from "@/lib/audio/headphoneProfiles";
import { Button, Chip, Panel } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

const KIND_ICON: Record<DeviceKind, React.ElementType> = {
  bluetooth: Bluetooth,
  airpods: Headphones,
  usb: Usb,
  wired: Cable,
  builtin: MonitorSpeaker,
  unknown: Speaker,
};

const SPECS = PRIMARY_PROFILE.specs!;

/** The spec sheet, as short chips. */
const SPEC_CHIPS = [
  `${SPECS.driverMm} mm driver`,
  `${SPECS.impedanceOhms} Ω`,
  `${SPECS.freqLow} Hz – ${SPECS.freqHigh / 1000} kHz`,
  `BT ${SPECS.bluetooth}`,
  SPECS.codecs.join(" · "),
  `${SPECS.batteryHours} h`,
  SPECS.anc ? "ANC" : "Passive isolation",
];

/**
 * Pairing walkthrough for the 730BT. These are the steps that actually matter
 * when the headphone is not showing up as an output device: the browser can
 * only route to something the OS has already paired.
 */
const PAIRING_STEPS = [
  "Hold the power button for about 5 seconds until the LED flashes.",
  "Pair the headphones in your operating system's Bluetooth settings — the browser cannot pair them for you.",
  "Come back here and pick “JBL Tune 730BT” from the list below.",
];

export const DevicePanel: React.FC = () => {
  const {
    deviceSupport,
    outputDevices,
    selectedDeviceId,
    deviceLabelsHidden,
    routingActive,
    detectedProfile,
    primaryConnected,
    refreshDevices,
    selectOutputDevice,
    unlockDeviceLabels,
    openSystemDevicePicker,
    applyDetectedProfile,
    bluetoothConnected,
    bluetoothDeviceName,
    bluetoothBattery,
    bluetoothBatterySupported,
    connectBluetooth,
    disconnectBluetooth,
    hydrated,
  } = useAudioStore();

  const [busy, setBusy] = React.useState<string | null>(null);
  const [showHelp, setShowHelp] = React.useState(false);
  const [linking, setLinking] = React.useState(false);

  // Enumerate on mount and whenever the OS device list changes, so pairing the
  // headphones updates the list without a reload.
  useEffect(() => {
    if (!hydrated) return;
    void refreshDevices();
    return onDeviceChange(() => void refreshDevices());
  }, [hydrated, refreshDevices]);

  const handleSelect = async (deviceId: string) => {
    setBusy(deviceId);
    await selectOutputDevice(deviceId);
    setBusy(null);
  };

  const handleLink = async (jblOnly: boolean) => {
    setLinking(true);
    await connectBluetooth(jblOnly);
    setLinking(false);
  };

  const selected = outputDevices.find((d) => d.deviceId === selectedDeviceId);

  return (
    <Panel
      title="JBL Tune 730BT"
      subtitle={
        primaryConnected && routingActive
          ? "Connected — DSP chain routed to your headphones"
          : routingActive && selected
            ? `Routing to ${selected.label}`
            : "Not detected — pair in system settings, then select below"
      }
      icon={<Headphones size={15} />}
      actions={
        <Button
          variant="ghost"
          onClick={() => void refreshDevices()}
          aria-label="Rescan devices"
          className="px-2"
        >
          <RefreshCw size={13} />
        </Button>
      }
      bodyClassName="space-y-3.5"
    >
      {/* ---- House headphone status ---- */}
      <div
        className={cn(
          "rounded-lg border p-3 transition-colors",
          primaryConnected
            ? "border-ok/35 bg-ok/[0.07]"
            : "border-line-soft bg-white/[0.02]"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Headphones
              size={15}
              className={primaryConnected ? "text-ok" : "text-faint"}
            />
            <span className="text-[12px] font-medium text-ink">
              JBL Tune 730BT
            </span>
          </div>
          <Chip tone={primaryConnected ? "ok" : "neutral"} pulse={primaryConnected}>
            {primaryConnected ? "Active output" : "Standby"}
          </Chip>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SPEC_CHIPS.map((spec) => (
            <Chip key={spec}>{spec}</Chip>
          ))}
        </div>

        {!primaryConnected && (
          <>
            <button
              onClick={() => setShowHelp((v) => !v)}
              className="at-focus mt-2.5 flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
            >
              <ChevronDown
                size={12}
                className={cn("transition-transform", showHelp && "rotate-180")}
              />
              How do I connect them?
            </button>

            {showHelp && (
              <ol className="mt-2 space-y-1.5 pl-1 text-[11px] leading-relaxed text-faint">
                {PAIRING_STEPS.map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="at-mono shrink-0 text-accent">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      {/* ---- Device list ---- */}
      {!deviceSupport.canEnumerate ? (
        <p className="at-inset px-3 py-3 text-[11px] leading-relaxed text-faint">
          This browser does not expose audio devices to web pages. Select your headphones in your
          operating system&apos;s sound settings instead — the studio will follow the system default.
        </p>
      ) : (
        <div className="max-h-[13rem] space-y-1.5 overflow-y-auto pr-0.5">
          {outputDevices.length === 0 && (
            <p className="at-inset px-3 py-3 text-[11px] text-faint">
              No output devices reported yet. Try rescanning.
            </p>
          )}

          {outputDevices.map((device) => {
            const Icon = KIND_ICON[device.kind];
            const isActive = device.deviceId === selectedDeviceId;
            const isPrimary = /tune ?730|t730/i.test(device.label);

            return (
              <button
                key={device.deviceId + device.groupId}
                onClick={() => void handleSelect(device.deviceId)}
                disabled={busy !== null}
                className={cn(
                  "at-focus flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "border-accent/45 bg-accent/[0.08]"
                    : isPrimary
                      ? "border-accent/25 bg-white/[0.03] hover:border-accent/45"
                      : "border-line-soft bg-white/[0.02] hover:border-line hover:bg-white/[0.04]"
                )}
              >
                <Icon
                  size={15}
                  className={cn("shrink-0", isActive ? "text-accent" : "text-faint")}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-[12px] font-medium",
                      isActive ? "text-ink" : "text-dim"
                    )}
                  >
                    {device.label}
                  </span>
                  <span className="at-mono block text-[10px] uppercase tracking-wider text-faint">
                    {isPrimary
                      ? "Your headphones"
                      : device.isDefault
                        ? "System default"
                        : device.kind}
                    {!isPrimary && device.isHeadphone ? " · headphones" : ""}
                  </span>
                </span>
                {busy === device.deviceId ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-accent" />
                ) : (
                  isActive && <Check size={14} className="shrink-0 text-accent" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ---- Permission / picker helpers ---- */}
      <div className="flex flex-wrap gap-2">
        {deviceLabelsHidden && (
          <Button variant="primary" onClick={() => void unlockDeviceLabels()}>
            Show device names
          </Button>
        )}
        {deviceSupport.canPick && (
          <Button onClick={() => void openSystemDevicePicker()}>Browser picker…</Button>
        )}
      </div>

      {deviceLabelsHidden && (
        <p className="text-[11px] leading-relaxed text-faint">
          Browsers hide device names until the page holds an audio permission. Granting it once
          reveals which entry is your 730BT; the microphone is released immediately and nothing is
          recorded.
        </p>
      )}

      {!deviceSupport.canRoute && deviceSupport.canEnumerate && (
        <p className="at-inset flex gap-2 px-3 py-2.5 text-[11px] leading-relaxed text-faint">
          <Info size={13} className="mt-[1px] shrink-0 text-warm" />
          <span>
            This browser cannot re-target audio output from a page. Chrome, Edge and Brave can —
            elsewhere, pick the 730BT in system sound settings and everything still runs through the
            DSP chain.
          </span>
        </p>
      )}

      {/* ---- Auto-detected tuning for anything that is not the house model ---- */}
      {detectedProfile && !primaryConnected && (
        <div className="rounded-lg border border-accent2/30 bg-accent2/[0.07] p-3">
          <div className="flex items-start gap-2">
            <Wand2 size={14} className="mt-[2px] shrink-0 text-accent2" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-ink">
                {detectedProfile.brand} {detectedProfile.model} detected
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-faint">{detectedProfile.notes}</p>
              <Button variant="primary" className="mt-2.5" onClick={applyDetectedProfile}>
                Apply matched tuning
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Bluetooth battery telemetry ---- */}
      <div className="border-t border-line-soft pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {bluetoothConnected ? (
              <BluetoothConnected size={14} className="text-accent" />
            ) : (
              <Bluetooth size={14} className="text-faint" />
            )}
            <span className="text-[12px] font-medium text-dim">Battery telemetry</span>
          </div>

          {bluetoothConnected ? (
            <Button variant="ghost" onClick={disconnectBluetooth}>
              Unlink
            </Button>
          ) : (
            <Button
              onClick={() => void handleLink(true)}
              disabled={!deviceSupport.canBluetooth || linking}
            >
              {linking ? <Loader2 size={12} className="animate-spin" /> : <BatteryFull size={12} />}
              Find my 730BT
            </Button>
          )}
        </div>

        {bluetoothConnected ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Chip tone="accent" pulse>
              {bluetoothDeviceName}
            </Chip>
            {bluetoothBatterySupported && bluetoothBattery !== null ? (
              <Chip tone={bluetoothBattery < 20 ? "warn" : "ok"}>Battery {bluetoothBattery}%</Chip>
            ) : (
              <Chip>Battery not reported</Chip>
            )}
          </div>
        ) : (
          <>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              Optional, and separate from the audio path. The 730BT is an LE Audio headphone, so it
              can expose battery level over BLE — but only while it is advertising. Hold the power
              button until the LED flashes, then scan.
            </p>
            {deviceSupport.canBluetooth && (
              <button
                onClick={() => void handleLink(false)}
                disabled={linking}
                className="at-focus mt-1.5 text-[11px] font-medium text-accent hover:underline disabled:opacity-40"
              >
                Scan all devices instead
              </button>
            )}
            {!deviceSupport.canBluetooth && (
              <p className="mt-1.5 text-[11px] text-faint">
                This browser has no Web Bluetooth. Chrome, Edge and Brave do.
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
};
