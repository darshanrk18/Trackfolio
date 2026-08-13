import { ProgressRing } from "@/components/ui/feedback";
import type { HealthCheck, HealthReport } from "@/lib/analysis/health";
import { cn } from "@/lib/utils";

const MARK: Record<HealthCheck["state"], string> = {
  pass: "✓",
  warn: "!",
  fail: "✕",
  skip: "–",
};

export function HealthPanel({ report }: { report: HealthReport }) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <ProgressRing
        value={report.score}
        size={112}
        thickness={9}
        label={report.score}
        sublabel={report.grade}
      />
      <ul className="flex min-w-[250px] flex-1 flex-col gap-1.5">
        {report.checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-[13px]">
            <span
              className={cn(
                "w-4 shrink-0 font-bold",
                check.state === "pass" && "text-ok",
                check.state === "warn" && "text-warn",
                check.state === "fail" && "text-bad",
                check.state === "skip" && "text-ink-3",
              )}
              aria-hidden
            >
              {MARK[check.state]}
            </span>
            <span>
              <strong>{check.label}</strong>{" "}
              <span className="text-ink-3 text-[11.5px]">{check.why}</span>
              {check.fix && check.state !== "pass" && (
                <span className="text-ink-2 mt-0.5 block text-[11.5px]">
                  {check.fix}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
