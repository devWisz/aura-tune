"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, ToastTone } from "@/store/useToastStore";
import { cn } from "@/lib/cn";

const ICONS: Record<ToastTone, React.ElementType> = {
  info: Info,
  success: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
};

const TONE_CLASS: Record<ToastTone, string> = {
  info: "text-accent",
  success: "text-ok",
  warn: "text-warm",
  error: "text-danger",
};

export const ToastHost: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-pop-in items-start gap-2.5 rounded-xl border border-line-soft bg-raised/95 p-3 shadow-[0_20px_45px_-20px_rgb(0,0,0,0.95)] backdrop-blur-md"
          >
            <Icon size={15} className={cn("mt-[1px] shrink-0", TONE_CLASS[t.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[11px] leading-snug text-faint">{t.body}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="at-focus -m-1 rounded p-1 text-faint transition-colors hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
