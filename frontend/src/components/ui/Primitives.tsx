"use client";

import React from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */
export const Panel: React.FC<{
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, actions, icon, className, bodyClassName, children }) => (
  <section className={cn("at-panel flex flex-col", className)}>
    {(title || actions) && (
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <span className="text-accent shrink-0">{icon}</span>}
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-faint">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
    )}
    <div className={cn("flex-1 p-4 sm:p-5", bodyClassName)}>{children}</div>
  </section>
);

/* ------------------------------------------------------------------ *
 * Button
 * ------------------------------------------------------------------ */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
  active?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  variant = "outline",
  size = "sm",
  active = false,
  className,
  children,
  ...rest
}) => (
  <button
    {...rest}
    className={cn(
      "at-focus inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
      "disabled:cursor-not-allowed disabled:opacity-40",
      size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]",
      variant === "primary" &&
        "bg-accent text-[#04121a] hover:bg-accent/85 shadow-[0_0_20px_-6px_rgb(var(--accent)/0.7)]",
      variant === "outline" &&
        "border border-line bg-white/[0.03] text-dim hover:border-accent/50 hover:text-ink",
      variant === "ghost" && "text-faint hover:bg-white/5 hover:text-ink",
      variant === "danger" &&
        "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
      active && variant !== "primary" && "border-accent/60 bg-accent/10 text-accent",
      className
    )}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ *
 * Segmented control
 * ------------------------------------------------------------------ */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "sm",
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
  className?: string;
  size?: "xs" | "sm";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line-soft bg-sunken/70 p-0.5",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.id}
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "at-focus rounded-[6px] font-medium transition-colors",
            size === "xs" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-[11px]",
            value === option.id
              ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.35)]"
              : "text-faint hover:text-dim"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Slider — a labelled range with a filled track
 * ------------------------------------------------------------------ */
export const Slider: React.FC<{
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  accentOff?: boolean;
}> = ({ label, value, min, max, step = 0.01, onChange, format, disabled, className, accentOff }) => {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("space-y-1.5", disabled && "opacity-45", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="at-label">{label}</span>
          <span className="at-mono text-[11px] text-dim">
            {format ? format(value) : value.toFixed(2)}
          </span>
        </div>
      )}
      <input
        type="range"
        className="at-slider w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={
          {
            "--fill": `${pct}%`,
            ...(accentOff ? { filter: "grayscale(1)" } : null),
          } as React.CSSProperties
        }
      />
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Toggle switch
 * ------------------------------------------------------------------ */
export const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, hint, disabled }) => (
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "at-focus flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
      checked
        ? "border-accent/40 bg-accent/[0.07]"
        : "border-line-soft bg-white/[0.02] hover:border-line",
      disabled && "cursor-not-allowed opacity-40"
    )}
  >
    <span className="min-w-0">
      <span className={cn("block text-[12px] font-medium", checked ? "text-ink" : "text-dim")}>
        {label}
      </span>
      {hint && <span className="mt-0.5 block text-[11px] leading-snug text-faint">{hint}</span>}
    </span>
    <span
      className={cn(
        "relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-line"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[14px] w-[14px] rounded-full bg-white transition-transform",
          checked ? "translate-x-[17px]" : "translate-x-[3px]"
        )}
      />
    </span>
  </button>
);

/* ------------------------------------------------------------------ *
 * Status chip
 * ------------------------------------------------------------------ */
export const Chip: React.FC<{
  tone?: "neutral" | "ok" | "warn" | "accent";
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}> = ({ tone = "neutral", children, className, pulse }) => (
  <span
    className={cn(
      "at-mono inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[10px] uppercase tracking-wider",
      tone === "neutral" && "border-line-soft bg-white/[0.02] text-faint",
      tone === "ok" && "border-ok/30 bg-ok/10 text-ok",
      tone === "warn" && "border-warm/30 bg-warm/10 text-warm",
      tone === "accent" && "border-accent/30 bg-accent/10 text-accent",
      className
    )}
  >
    {pulse && (
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping-ring rounded-full bg-current" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
    )}
    {children}
  </span>
);

/* ------------------------------------------------------------------ *
 * Empty state
 * ------------------------------------------------------------------ */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon, title, body, action }) => (
  <div className="at-inset flex flex-col items-center gap-2 px-6 py-8 text-center">
    {icon && <div className="text-faint">{icon}</div>}
    <p className="text-[13px] font-medium text-dim">{title}</p>
    {body && <p className="max-w-sm text-[11px] leading-relaxed text-faint">{body}</p>}
    {action && <div className="pt-1.5">{action}</div>}
  </div>
);
