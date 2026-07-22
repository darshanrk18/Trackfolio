"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCReactProvider } from "@/trpc/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={["light", "dark"]}
    >
      <TRPCReactProvider>
        <TooltipProvider delayDuration={350} skipDelayDuration={200}>
          {children}
          <Toaster
            position="bottom-right"
            closeButton
            richColors={false}
            toastOptions={{
              classNames: {
                toast:
                  "!bg-[var(--surface)] !text-[var(--ink)] !border-[var(--line-2)] !shadow-[var(--shadow-md)] !rounded-[var(--radius-md)]",
                description: "!text-[var(--ink-2)]",
                actionButton:
                  "!bg-[var(--primary)] !text-[var(--on-primary)] !rounded-[var(--radius-xs)]",
                cancelButton: "!bg-[var(--surface-2)] !text-[var(--ink-2)]",
                error: "!border-[var(--bad-border)]",
                success: "!border-[var(--ok-border)]",
                warning: "!border-[var(--warn-border)]",
              },
            }}
          />
        </TooltipProvider>
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
