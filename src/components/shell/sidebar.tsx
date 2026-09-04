"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { isNavActive, MODE_NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { Logo } from "./logo";

export interface BadgeCounts {
  actions?: number;
  applications?: number;
  versions?: number;
  contacts?: number;
  coverLetters?: number;
}

const COLLAPSE_KEY = "trackfolio:sidebar-collapsed";
const sidebarListeners = new Set<() => void>();

function subscribeSidebar(onStoreChange: () => void) {
  sidebarListeners.add(onStoreChange);
  return () => {
    sidebarListeners.delete(onStoreChange);
  };
}

function getSidebarCollapsed() {
  return localStorage.getItem(COLLAPSE_KEY) === "true";
}

function setSidebarCollapsed(next: boolean) {
  localStorage.setItem(COLLAPSE_KEY, String(next));
  sidebarListeners.forEach((listener) => listener());
}

export function Sidebar({
  counts = {},
  alerts = {},
}: {
  counts?: BadgeCounts;
  /** Badge keys that should render in the alert colour. */
  alerts?: Partial<Record<keyof BadgeCounts, boolean>>;
}) {
  const pathname = usePathname();
  const collapsed = React.useSyncExternalStore(
    subscribeSidebar,
    getSidebarCollapsed,
    () => false,
  );

  const toggle = React.useCallback(() => {
    setSidebarCollapsed(!getSidebarCollapsed());
  }, []);

  return (
    <nav
      aria-label="Primary"
      data-collapsed={collapsed || undefined}
      className={cn(
        "bg-surface border-line sticky top-0 hidden h-dvh shrink-0 flex-col border-r lg:flex",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[228px]",
      )}
    >
      <div className={cn("flex items-center gap-2 px-4 pt-4 pb-3", collapsed && "px-3")}>
        <Logo compact={collapsed} />
      </div>

      <div className="scrollbar-none flex-1 overflow-y-auto pb-2">
        <p className={cn("text-eyebrow mt-2 mb-1 px-4", collapsed && "sr-only")}>Modes</p>
        <ul className="space-y-px px-2">
          {MODE_NAV.map((item) => {
            const active = isNavActive(pathname, item.href);
            const count = item.badgeKey ? counts[item.badgeKey] : undefined;
            const isAlert = item.badgeKey ? alerts[item.badgeKey] : false;

            const link = (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2",
                  "text-[13.5px] transition-colors duration-100",
                  collapsed && "justify-center px-0 py-2.5",
                  active
                    ? "bg-primary-soft text-primary-ink font-semibold"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "opacity-100" : "opacity-70 group-hover:opacity-100",
                  )}
                  aria-hidden
                />
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    <CountBadge count={count ?? 0} alert={isAlert} />
                  </>
                )}
                {collapsed && <span className="sr-only">{item.label}</span>}
              </Link>
            );

            return (
              <li key={item.href}>
                {collapsed ? (
                  <Hint label={`${item.label} · ${item.shortcut ?? ""}`} side="right">
                    {link}
                  </Hint>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-line border-t p-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className={cn(
            "text-ink-3 hover:bg-surface-2 hover:text-ink flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12.5px] transition-colors",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden />
          )}
          {!collapsed && <span>Collapse</span>}
          <span className="sr-only">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </button>
      </div>
    </nav>
  );
}

/** Four-mode bar on small screens. Overflow lives in the account menu. */
export function MobileTabBar({
  counts = {},
  alerts = {},
}: {
  counts?: BadgeCounts;
  alerts?: Partial<Record<keyof BadgeCounts, boolean>>;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-line bg-surface/95 safe-bottom fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-4 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        {MODE_NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          const count = item.badgeKey ? counts[item.badgeKey] : undefined;
          const isAlert = item.badgeKey ? Boolean(alerts[item.badgeKey]) : false;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1.5 text-[10.5px]",
                  active ? "text-primary-ink font-semibold" : "text-ink-3",
                )}
              >
                <item.icon className={cn("size-4", active && "text-primary")} aria-hidden />
                {item.label}
                {Boolean(count) && (
                  <span
                    className={cn(
                      "absolute top-0.5 right-2 size-1.5 rounded-full",
                      isAlert ? "bg-bad" : "bg-primary",
                    )}
                    aria-hidden
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
