"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ActionItem, ActionKind, ActionType } from "@/lib/insights/actions";

const RAIL: Record<ActionKind, string> = {
  urgent: "shadow-[inset_3px_0_0_var(--bad)]",
  soon: "shadow-[inset_3px_0_0_var(--warn)]",
  info: "shadow-[inset_3px_0_0_var(--primary)]",
};

const KIND_LABEL: Record<ActionKind, string> = {
  urgent: "Urgent",
  soon: "Soon",
  info: "Later",
};

const CTA: Record<ActionType, string> = {
  follow_up: "Follow up",
  stale: "Open application",
  interview: "Prepare",
  missing_jd: "Archive JD",
  missing_snapshot: "Freeze snapshot",
  incomplete: "Set next step",
  contact: "Reach out",
};

export function ActionQueue({
  items,
  compact = false,
}: {
  items: readonly ActionItem[];
  compact?: boolean;
}) {
  return (
    <ul className={cn("space-y-2", compact && "space-y-1.5")}>
      {items.map((action) => (
        <li key={action.id}>
          <div
            className={cn(
              "border-line bg-surface flex items-start gap-3 rounded-[var(--radius-md)] border px-3 py-2.5",
              RAIL[action.kind],
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-eyebrow">{KIND_LABEL[action.kind]}</p>
              <p className="text-[13px] font-semibold">{action.title}</p>
              <p className="text-ink-3 mt-0.5 text-[11.5px]">
                {action.meta}
                {action.role ? ` · ${action.role}` : ""}
              </p>
            </div>
            <Button variant="secondary" size="xs" asChild>
              <Link href={action.href}>
                {CTA[action.type]}
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
