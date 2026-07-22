"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "./button";
import { clamp, cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-[var(--radius-sm)]", className)} />;
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span role="status" className={cn("text-ink-3 inline-flex items-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spin"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">Loading</span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-line-2 flex flex-col items-center justify-center rounded-[var(--radius-lg)]",
        "border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div
          className="bg-surface-2 text-ink-3 mb-3 flex size-10 items-center justify-center rounded-full [&_svg]:size-5"
          aria-hidden
        >
          {icon}
        </div>
      )}
      <p className="text-ink text-[14px] font-semibold">{title}</p>
      {description && (
        <p className="text-ink-2 mt-1 max-w-[46ch] text-[12.5px]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Try again in a moment.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-bad-border bg-bad-soft/40 flex flex-col items-center justify-center",
        "rounded-[var(--radius-lg)] border px-6 py-10 text-center",
        className,
      )}
    >
      <TriangleAlert className="text-bad size-5" aria-hidden />
      <p className="text-ink mt-2.5 text-[14px] font-semibold">{title}</p>
      {description && (
        <p className="text-ink-2 mt-1 max-w-[46ch] text-[12.5px]">{description}</p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          <RefreshCw aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}

export type Tone = "neutral" | "primary" | "ok" | "warn" | "bad";

const ringStroke: Record<Exclude<Tone, "neutral">, string> = {
  primary: "stroke-primary",
  ok: "stroke-ok",
  warn: "stroke-warn",
  bad: "stroke-bad",
};

export function ProgressRing({
  value,
  size = 88,
  thickness = 8,
  label,
  sublabel,
  tone = "auto",
  className,
}: {
  value: number;
  size?: number;
  thickness?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: "auto" | "primary" | "ok" | "warn" | "bad";
  className?: string;
}) {
  const percent = clamp(Number.isFinite(value) ? value : 0, 0, 100);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const resolvedTone =
    tone === "auto" ? (percent >= 75 ? "ok" : percent >= 50 ? "warn" : "bad") : tone;

  return (
    <div
      role="img"
      aria-label={`${Math.round(percent)} out of 100`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className={cn(
            "transition-[stroke-dashoffset] duration-500 ease-out",
            ringStroke[resolvedTone],
          )}
        />
      </svg>
      {(label !== undefined || sublabel !== undefined) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
          aria-hidden
        >
          {label !== undefined && (
            <span className="font-display text-[18px] leading-none font-semibold tabular-nums">
              {label}
            </span>
          )}
          {sublabel !== undefined && (
            <span className="text-ink-3 font-mono text-[9.5px] tracking-wide uppercase">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const valueTone: Record<Tone, string> = {
  neutral: "text-ink",
  primary: "text-primary",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
};

export function StatCard({
  label,
  value,
  delta,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** Signed percentage change against the previous period. */
  delta?: number;
  hint?: string;
  tone?: Tone;
  className?: string;
}) {
  const DeltaIcon =
    delta === undefined || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={cn(
        "bg-surface border-line rounded-[var(--radius-lg)] border px-4 py-3",
        className,
      )}
    >
      <p className="text-eyebrow">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={cn(
            "font-display text-[22px] leading-none font-semibold tabular-nums",
            valueTone[tone],
          )}
        >
          {value}
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums",
              delta > 0 ? "text-ok" : delta < 0 ? "text-bad" : "text-ink-3",
            )}
          >
            <DeltaIcon className="size-3" aria-hidden />
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      {hint && <p className="text-ink-3 mt-1.5 text-[11.5px]">{hint}</p>}
    </div>
  );
}
