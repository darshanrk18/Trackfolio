import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive,
  accent,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  /** Left rail colour used to convey urgency at a glance. */
  accent?: "primary" | "ok" | "warn" | "bad" | "none";
}) {
  return (
    <div
      className={cn(
        "bg-surface border-line rounded-[var(--radius-lg)] border",
        interactive &&
          "hover:border-line-2 hover:shadow-sm cursor-pointer transition-[border-color,box-shadow]",
        accent === "primary" && "shadow-[inset_3px_0_0_var(--primary)]",
        accent === "ok" && "shadow-[inset_3px_0_0_var(--ok)]",
        accent === "warn" && "shadow-[inset_3px_0_0_var(--warn)]",
        accent === "bad" && "shadow-[inset_3px_0_0_var(--bad)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-3 px-4 pt-3.5 pb-2", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  as: Comp = "h3",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return <Comp className={cn("text-[14px] leading-tight font-semibold", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-ink-2 mt-0.5 max-w-[70ch] text-[12.5px]", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pt-1 pb-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-line bg-surface-2/40 flex items-center gap-2 border-t px-4 py-2.5",
        className,
      )}
      {...props}
    />
  );
}

/** Section heading used between cards on a page. */
export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-end justify-between gap-4", className)}>
      <div>
        <h3 className="text-[14.5px] font-semibold">{title}</h3>
        {description && (
          <p className="text-ink-2 mt-0.5 max-w-[72ch] text-[12.5px]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
