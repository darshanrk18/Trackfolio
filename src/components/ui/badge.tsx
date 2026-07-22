import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-ink-2 border-line",
        primary: "bg-primary-soft text-primary-ink border-transparent",
        ok: "bg-ok-soft text-ok border-transparent",
        warn: "bg-warn-soft text-warn border-transparent",
        bad: "bg-bad-soft text-bad border-transparent",
        info: "bg-info-soft text-info border-transparent",
        outline: "bg-transparent text-ink-2 border-line-2",
      },
      size: {
        sm: "px-1.5 py-0 text-[10px]",
        md: "px-2 py-0.5 text-[11px]",
      },
      mono: { true: "font-mono tracking-tight", false: "" },
    },
    defaultVariants: { tone: "neutral", size: "md", mono: false },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, mono, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size, mono }), className)} {...props} />;
}

/** Small counter shown beside navigation items. */
export function CountBadge({
  count,
  alert,
  className,
}: {
  count: number;
  alert?: boolean;
  className?: string;
}) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums",
        alert ? "bg-bad-soft text-bad" : "bg-surface-2 text-ink-3",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** A single removable keyword chip. */
export function Chip({
  children,
  tone = "neutral",
  onRemove,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "bad" | "primary" | "dashed";
  onRemove?: () => void;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const Wrapper = onClick ? "button" : "span";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]",
        tone === "neutral" && "bg-surface-2 text-ink-2 border-line",
        tone === "ok" && "bg-ok-soft text-ok border-ok-border",
        tone === "bad" && "bg-bad-soft text-bad border-bad-border",
        tone === "primary" && "bg-primary-soft text-primary-ink border-transparent",
        tone === "dashed" &&
          "text-ink-2 border-line-2 hover:text-primary hover:border-primary border-dashed",
        onClick && "cursor-pointer transition-colors",
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:text-bad -mr-0.5 ml-0.5 text-[13px] leading-none opacity-60 hover:opacity-100"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </Wrapper>
  );
}
