import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Persistent master lock rail. Unlock is session-only. Tailoring always forks.
 */
export function MasterLockRail({
  isMaster,
  locked,
  onToggle,
  className,
}: {
  isMaster: boolean;
  locked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "border-line bg-surface-2/80 flex flex-col gap-2 rounded-[var(--radius-md)] border px-3 py-3",
        locked && isMaster && "border-primary-border bg-primary-soft/40",
        className,
      )}
    >
      <p className="text-eyebrow flex items-center gap-1.5">
        {locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
        Master protection
      </p>
      {isMaster ? (
        <>
          <p className="text-[12.5px] font-semibold">
            {locked ? "Master is locked" : "Unlocked for this session"}
          </p>
          <p className="text-ink-2 text-[12px] leading-relaxed">
            Tailor on a branch. Reloading or switching branches locks master
            again. The backend still refuses delete or archive of master.
          </p>
          <Button variant={locked ? "secondary" : "primary"} size="sm" onClick={onToggle}>
            {locked ? (
              <>
                <Unlock className="size-3.5" />
                Master locked
              </>
            ) : (
              <>
                <Lock className="size-3.5" />
                Master unlocked
              </>
            )}
          </Button>
        </>
      ) : (
        <>
          <p className="text-[12.5px] font-semibold">Working on a branch</p>
          <p className="text-ink-2 text-[12px] leading-relaxed">
            Master stays protected. Create another branch to tailor for a
            different company — never write tailored content onto master.
          </p>
        </>
      )}
    </aside>
  );
}
