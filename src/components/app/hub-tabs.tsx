"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface HubTab {
  href: string;
  label: string;
}

export function HubTabs({
  items,
  className,
}: {
  items: readonly HubTab[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Section"
      className={cn("border-line mb-5 flex flex-wrap items-center gap-4 border-b", className)}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-0.5 pt-1 pb-2 text-[13px] transition-colors",
              active
                ? "border-[var(--primary)] text-ink font-medium"
                : "text-ink-2 hover:text-ink border-transparent",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const DOCUMENT_TABS: readonly HubTab[] = [
  { href: "/resume", label: "Lab" },
  { href: "/cover-letters", label: "Cover letters" },
  { href: "/history", label: "History" },
  { href: "/compare", label: "Compare" },
];

export const INSIGHT_TABS: readonly HubTab[] = [
  { href: "/analyze", label: "Fit" },
  { href: "/assistant", label: "Assistant" },
  { href: "/analytics", label: "Conversion" },
];
