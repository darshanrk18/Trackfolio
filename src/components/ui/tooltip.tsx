"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    arrow?: boolean;
  }
>(function TooltipContent(
  { className, sideOffset = 6, arrow = true, children, ...props },
  ref,
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "bg-ink text-ink-inverse z-50 max-w-[260px] rounded-[var(--radius-sm)] px-2 py-1",
          "text-[11.5px] leading-snug shadow-md",
          "origin-[var(--radix-tooltip-content-transform-origin)]",
          "data-[state=delayed-open]:animate-[scale-in_.16s_cubic-bezier(.22,1,.36,1)]",
          className,
        )}
        {...props}
      >
        {children}
        {arrow && <TooltipPrimitive.Arrow className="fill-ink" width={9} height={5} />}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});

export interface HintProps {
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
}

/**
 * Trigger plus content in one call. Carries its own provider so a hint can be
 * dropped anywhere without the caller wiring one up.
 *
 * Non-element children are wrapped in a focusable span so the hint stays
 * reachable by keyboard.
 */
export function Hint({ label, children, side = "top", delayDuration = 250 }: HintProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        {React.isValidElement(children) ? (
          <TooltipTrigger asChild>{children}</TooltipTrigger>
        ) : (
          <TooltipTrigger className="cursor-default outline-none">{children}</TooltipTrigger>
        )}
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger };
