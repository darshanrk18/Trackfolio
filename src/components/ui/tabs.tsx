"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export type TabsVariant = "underline" | "pill";

const TabsVariantContext = React.createContext<TabsVariant>("underline");

const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: TabsVariant;
  }
>(function TabsList({ className, variant = "underline", ...props }, ref) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          variant === "underline" && "border-line flex items-center gap-4 border-b",
          variant === "pill" &&
            "bg-surface-2 inline-flex items-center gap-1 rounded-[var(--radius-md)] p-1",
          className,
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  );
});

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "text-ink-2 hover:text-ink inline-flex items-center gap-1.5 whitespace-nowrap transition-colors outline-none",
        "disabled:pointer-events-none disabled:opacity-45",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        variant === "underline" && [
          "-mb-px border-b-2 border-transparent px-0.5 pt-1 pb-2 text-[13px]",
          "data-[state=active]:text-ink data-[state=active]:border-[var(--primary)] data-[state=active]:font-medium",
        ],
        variant === "pill" && [
          "rounded-[var(--radius-sm)] px-2.5 py-1 text-[12.5px]",
          "data-[state=active]:bg-primary-soft data-[state=active]:text-primary-ink data-[state=active]:font-medium",
        ],
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-3 outline-none",
        "data-[state=active]:animate-[fade-in_.18s_cubic-bezier(.22,1,.36,1)]",
        className,
      )}
      {...props}
    />
  );
});

export { Tabs };
