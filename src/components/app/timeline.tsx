import { formatDateTime, relativeTime, cn } from "@/lib/utils";

export interface TimelineEntry {
  id: string;
  label: string;
  at: Date | string;
  body?: string | null;
}

export function Timeline({
  items,
  empty = "No activity yet.",
  compact,
  className,
}: {
  items: readonly TimelineEntry[];
  empty?: string;
  compact?: boolean;
  className?: string;
}) {
  if (items.length === 0) {
    return <p className="text-ink-3 text-[13px]">{empty}</p>;
  }

  return (
    <ol className={cn("border-line ml-1.5 border-l-2", className)}>
      {items.map((item) => (
        <li key={item.id} className={cn("relative pl-4", compact ? "pb-2.5" : "pb-3.5")}>
          <span
            className="bg-primary border-surface absolute top-1.5 -left-[5px] size-2 rounded-full border-2"
            aria-hidden
          />
          <p className="text-ink-3 font-mono text-[10px]">
            {compact ? relativeTime(item.at) : formatDateTime(item.at)}
          </p>
          <p className="text-[13px]">{item.label}</p>
          {item.body && (
            <p className="text-ink-2 mt-0.5 text-[12px] leading-relaxed">{item.body}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
