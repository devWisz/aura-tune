"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Space"], action: "Play / pause" },
  { keys: ["←", "→"], action: "Seek 5 seconds" },
  { keys: ["↑", "↓"], action: "Master volume" },
  { keys: ["M"], action: "Mute" },
  { keys: ["B"], action: "A/B bypass the equaliser" },
  { keys: ["N"], action: "Toggle masking noise" },
  { keys: ["[", "]"], action: "Previous / next track" },
  { keys: ["1", "2", "3", "4"], action: "Visualiser mode" },
  { keys: ["Shift", "↑/↓"], action: "Fine 0.5 dB fader steps" },
  { keys: ["Esc"], action: "Close this dialog" },
];

export const ShortcutsDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 grid place-items-center bg-bg/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="at-panel w-full max-w-md animate-pop-in p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-ink">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="at-focus rounded p-1 text-faint transition-colors hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>

        <dl className="space-y-1.5">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 odd:bg-white/[0.02]"
            >
              <dt className="text-[12px] text-dim">{shortcut.action}</dt>
              <dd className="flex shrink-0 gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="at-mono rounded-md border border-line-soft bg-sunken px-1.5 py-0.5 text-[10px] text-faint"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-[11px] leading-relaxed text-faint">
          Shortcuts are ignored while you are typing in a text field.
        </p>
      </div>
    </div>
  );
};
