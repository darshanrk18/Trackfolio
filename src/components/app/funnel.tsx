import { cn } from "@/lib/utils";

export function Funnel({
  stages,
  smallSample = false,
}: {
  stages: readonly { label: string; count: number; color?: string }[];
  /** Label conversion rates as noisy when the cohort is tiny (n < 3). */
  smallSample?: boolean;
}) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="flex flex-col gap-2">
      {stages.map((stage, index) => {
        const previous = index > 0 ? stages[index - 1] : undefined;
        const conversion =
          previous && previous.count > 0
            ? Math.round((stage.count / previous.count) * 100)
            : null;

        return (
          <div key={stage.label}>
            {conversion !== null && previous && (
              <p className="text-ink-3 mb-1 ml-[100px] font-mono text-[10px] tabular-nums">
                {conversion}% of {previous.label.toLowerCase()}
                {smallSample ? " · small sample" : ""}
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="text-ink-2 w-[88px] shrink-0 font-mono text-[11.5px]">
                {stage.label}
              </div>
              <div className="bg-sunken h-6.5 min-w-0 flex-1 overflow-hidden rounded-[6px]">
                <div
                  className={cn("h-full rounded-[6px] transition-[width] duration-500")}
                  style={{
                    width: `${(stage.count / max) * 100}%`,
                    background: stage.color ?? "var(--primary)",
                    minWidth: stage.count > 0 ? 2 : 0,
                  }}
                />
              </div>
              <div className="text-ink-2 w-16 shrink-0 text-right font-mono text-[11.5px] tabular-nums">
                {stage.count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
