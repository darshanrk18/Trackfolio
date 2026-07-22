"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "bg-line-strong inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent transition-colors outline-none",
        "data-[state=checked]:bg-primary",
        "focus-visible:ring-3 focus-visible:ring-[var(--primary-soft)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "bg-surface pointer-events-none block size-4 rounded-full shadow-xs",
          "translate-x-0 transition-transform data-[state=checked]:translate-x-4",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, checked, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      className={cn(
        "bg-surface border-line-2 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center",
        "rounded-[var(--radius-xs)] border transition-colors outline-none",
        "data-[state=checked]:bg-primary data-[state=checked]:text-on-primary data-[state=checked]:border-[var(--primary)]",
        "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-on-primary data-[state=indeterminate]:border-[var(--primary)]",
        "focus-visible:ring-3 focus-visible:ring-[var(--primary-soft)] focus-visible:border-[var(--primary)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} aria-hidden />
        ) : (
          <Check className="size-3" strokeWidth={3} aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

export interface SwitchFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** Labelled settings row; the whole row toggles the switch. */
export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: SwitchFieldProps) {
  const id = React.useId();
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start justify-between gap-4 py-2",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="text-ink block text-[13px] font-medium">{label}</span>
        {description && (
          <span
            id={descriptionId}
            className="text-ink-2 mt-0.5 block max-w-[60ch] text-[12px]"
          >
            {description}
          </span>
        )}
      </span>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={descriptionId}
        className="mt-0.5"
      />
    </label>
  );
}
