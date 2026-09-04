import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Visual seal for a frozen submission. A missing snapshot is a hole — dashed
 * frame plus the Action Center kind — never a greyed-out button pretending
 * the freeze already happened.
 */
export function FreezeStamp({
  frozen,
  at,
  versionLabel,
  pages,
  onCapture,
  capturing,
  className,
}: {
  frozen: boolean;
  at?: Date | string | null;
  versionLabel?: string | null;
  pages?: number | null;
  onCapture?: () => void;
  capturing?: boolean;
  className?: string;
}) {
  if (!frozen) {
    return (
      <div
        className={cn(
          "border-bad-border bg-bad-soft/30 flex flex-col items-start gap-2 rounded-[var(--radius-lg)] border border-dashed px-4 py-4",
          className,
        )}
      >
        <p className="text-eyebrow text-bad">Not frozen</p>
        <p className="text-[13.5px] font-semibold">No submission snapshot</p>
        <p className="text-ink-2 text-[12.5px]">
          Capture the exact resume this company received. Deleting a version later
          must not rewrite history.
        </p>
        {onCapture && (
          <Button variant="primary" size="sm" loading={capturing} onClick={onCapture}>
            Capture snapshot
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-ok-border bg-ok-soft/40 relative overflow-hidden rounded-[var(--radius-lg)] border px-4 py-4",
        className,
      )}
    >
      <div
        aria-hidden
        className="border-ok/25 pointer-events-none absolute -top-6 -right-6 size-24 rotate-12 rounded-full border-4"
      />
      <p className="text-eyebrow text-ok flex items-center gap-1.5">
        <Lock className="size-3" /> Frozen
      </p>
      <p className="mt-1 font-display text-[18px] font-semibold tracking-[-0.02em]">
        Submission sealed
      </p>
      <dl className="readout text-ink-2 mt-3 space-y-1 text-[11px]">
        <div className="flex justify-between gap-3">
          <dt>Captured</dt>
          <dd className="text-ink">{at ? formatDateTime(at) : "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Version</dt>
          <dd className="text-ink">{versionLabel || "Untitled"}</dd>
        </div>
        {pages != null && (
          <div className="flex justify-between gap-3">
            <dt>Pages</dt>
            <dd className="text-ink">{pages}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
