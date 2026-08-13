"use client";

import { cn } from "@/lib/utils";
import type { DiffOp, DiffStats } from "@/lib/diff";

export function DiffSummary({ stats }: { stats: DiffStats }) {
  return (
    <p className="font-mono text-[12px]">
      <span className="text-ok">+{stats.added}</span>
      <span className="text-ink-3"> · </span>
      <span className="text-bad">−{stats.removed}</span>
      <span className="text-ink-3">
        {" "}
        · {Math.round(stats.similarity * 100)}% similar
      </span>
    </p>
  );
}

export function DiffView({
  ops,
  granularity = "line",
  className,
}: {
  ops: readonly DiffOp[];
  granularity?: "line" | "word";
  className?: string;
}) {
  if (ops.length === 0) {
    return (
      <div className="border-line-2 text-ink-3 rounded-[var(--radius-lg)] border border-dashed px-6 py-10 text-center text-[13px]">
        Nothing to compare.
      </div>
    );
  }

  if (granularity === "word") {
    return (
      <div
        className={cn(
          "border-line bg-surface max-h-[460px] overflow-auto rounded-[var(--radius-lg)] border p-3 font-mono text-[12.5px] leading-relaxed",
          className,
        )}
      >
        {ops.map((op, i) => {
          if (op.type === "equal") return <span key={i}>{op.value}</span>;
          if (op.type === "insert") {
            return (
              <span key={i} className="bg-diff-add-bg text-diff-add-ink rounded-sm">
                {op.value}
              </span>
            );
          }
          return (
            <span
              key={i}
              className="bg-diff-del-bg text-diff-del-ink rounded-sm line-through"
            >
              {op.value}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-line bg-surface max-h-[520px] overflow-auto rounded-[var(--radius-lg)] border font-mono text-[12px] leading-[1.65]",
        className,
      )}
    >
      {ops.map((op, i) => {
        const mark = op.type === "insert" ? "+" : op.type === "delete" ? "−" : "\u00a0";
        return (
          <div
            key={i}
            className={cn(
              "flex whitespace-pre-wrap",
              op.type === "insert" && "bg-diff-add-bg text-diff-add-ink",
              op.type === "delete" && "bg-diff-del-bg text-diff-del-ink",
            )}
          >
            <span className="text-ink-3 w-6 shrink-0 text-center select-none">
              {mark}
            </span>
            <span className="min-w-0 flex-1 pr-3">{op.value || "\u00a0"}</span>
          </div>
        );
      })}
    </div>
  );
}
