"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const dialogSizes = {
  sm: "max-w-[400px]",
  md: "max-w-[560px]",
  lg: "max-w-[760px]",
  xl: "max-w-[980px]",
} as const;

export type DialogSize = keyof typeof dialogSizes;

export const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "bg-overlay fixed inset-0 z-50 backdrop-blur-sm",
        "data-[state=open]:animate-[fade-in_.18s_cubic-bezier(.22,1,.36,1)]",
        className,
      )}
      {...props}
    />
  );
});

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  size?: DialogSize;
  /** Hide the built-in close button when the footer already offers a way out. */
  showClose?: boolean;
  overlayClassName?: string;
}

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { className, overlayClassName, size = "md", showClose = true, children, ...props },
  ref,
) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "bg-surface border-line fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] flex-col",
          "max-h-[calc(100dvh-4rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden",
          "rounded-[var(--radius-lg)] border shadow-lg outline-none",
          "data-[state=open]:animate-[scale-in_.16s_cubic-bezier(.22,1,.36,1)]",
          dialogSizes[size],
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            className={cn(
              "text-ink-3 hover:bg-surface-2 hover:text-ink absolute top-3 right-3 z-10",
              "inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)]",
              "outline-none transition-colors",
              "focus-visible:ring-3 focus-visible:ring-[var(--primary-soft)]",
            )}
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-line shrink-0 border-b px-5 pt-4 pr-12 pb-3", className)}
      {...props}
    />
  );
}

/** Scrollable region between the header and footer. */
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...props} />
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-line bg-surface-2/40 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-[15px] leading-tight font-semibold", className)}
      {...props}
    />
  );
});

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-ink-2 mt-1 text-[12.5px]", className)}
      {...props}
    />
  );
});

/**
 * Radix warns when a dialog has no title. Use this when the design has no
 * visible heading so the dialog still gets an accessible name.
 */
export function DialogHiddenTitle({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Title asChild>
      <VisuallyHiddenPrimitive.Root>{children}</VisuallyHiddenPrimitive.Root>
    </DialogPrimitive.Title>
  );
}

export { Dialog, DialogTrigger, DialogPortal, DialogClose };
