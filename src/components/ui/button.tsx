"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium",
    "rounded-[var(--radius-sm)] border transition-[background-color,border-color,color,box-shadow,transform]",
    "duration-150 select-none outline-none",
    "focus-visible:ring-3 focus-visible:ring-[var(--primary-soft)] focus-visible:border-[var(--primary)]",
    "disabled:pointer-events-none disabled:opacity-45",
    "active:scale-[0.985]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-on-primary border-primary hover:bg-primary-hover hover:border-primary-hover shadow-xs",
        secondary:
          "bg-surface text-ink border-line hover:bg-surface-2 hover:border-line-2 shadow-xs",
        ghost:
          "bg-transparent text-ink-2 border-transparent hover:bg-surface-2 hover:text-ink",
        outline:
          "bg-transparent text-ink border-line-2 hover:bg-surface-2 hover:border-line-strong",
        danger:
          "bg-surface text-bad border-line hover:bg-bad-soft hover:border-bad-border",
        "danger-solid":
          "bg-bad text-white border-bad hover:brightness-110 shadow-xs",
        success:
          "bg-ok text-white border-ok hover:brightness-110 shadow-xs",
        link: "bg-transparent border-transparent text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        xs: "h-6 px-2 text-[11.5px] [&_svg]:size-3",
        sm: "h-7.5 px-2.5 text-[12.5px] [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-[13.5px] [&_svg]:size-4",
        lg: "h-10 px-5 text-sm [&_svg]:size-4",
        icon: "size-8 p-0 [&_svg]:size-4",
        "icon-sm": "size-7 p-0 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  /** Announced to screen readers while `loading` is true. */
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      children,
      disabled,
      type,
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";

    // `asChild` forwards to an arbitrary element, so injecting a spinner would
    // violate Slot's single-child contract.
    if (asChild) {
      return (
        <Comp
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <button
        ref={ref}
        // Buttons inside forms default to `submit`, which causes surprise
        // submissions; opt in explicitly instead.
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {loading && loadingText ? loadingText : children}
        {loading && !loadingText && <span className="sr-only">Loading</span>}
      </button>
    );
  },
);

export { buttonVariants };
