"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const controlClasses = [
  "w-full bg-surface text-ink border border-line rounded-[var(--radius-sm)]",
  "px-2.5 py-1.5 text-[13px] transition-[border-color,box-shadow] outline-none",
  "placeholder:text-ink-3",
  "focus-visible:border-[var(--primary)] focus-visible:ring-3 focus-visible:ring-[var(--primary-soft)]",
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-2",
  "aria-[invalid=true]:border-[var(--bad)] aria-[invalid=true]:ring-3 aria-[invalid=true]:ring-[var(--bad-soft)]",
].join(" ");

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }
>(function Input({ className, mono, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(controlClasses, mono && "font-mono text-[12px]", className)}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }
>(function Textarea({ className, mono, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        controlClasses,
        "min-h-[72px] resize-y leading-relaxed",
        mono && "font-mono text-[12px]",
        className,
      )}
      {...props}
    />
  );
});

/**
 * Native select styled to match. Radix Select is used where custom rendering is
 * needed; this covers the many simple enum pickers where native is faster and
 * works better on mobile.
 */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlClasses, "appearance-none pr-7", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="text-ink-3 pointer-events-none absolute top-1/2 right-2.5 size-2.5 -translate-y-1/2"
      >
        <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
});

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn("text-eyebrow mb-1 block", className)}
      {...props}
    />
  );
});

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label + control + hint/error, wired for accessibility.
 *
 * The error is rendered in a live region so screen readers announce validation
 * failures without the user having to hunt for them.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="text-bad ml-0.5" aria-hidden>
              *
            </span>
          )}
        </Label>
      )}
      {React.isValidElement(children) && htmlFor
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: htmlFor,
            "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
            "aria-invalid": error ? true : undefined,
          })
        : children}
      {hint && !error && (
        <p id={hintId} className="text-ink-3 mt-1 text-[11.5px]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-bad mt-1 text-[11.5px]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Inline editable table cell that looks like text until hovered or focused. */
export const CellInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function CellInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-[var(--radius-xs)] border border-transparent bg-transparent px-1.5 py-1 text-[13px]",
        "hover:border-line focus:border-[var(--primary)] focus:bg-[var(--surface)]",
        "outline-none transition-[border-color,background-color]",
        className,
      )}
      {...props}
    />
  );
});
