import { ProgressRing } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import type { HealthCheck, HealthReport } from "@/lib/analysis/health";
import { cn } from "@/lib/utils";

const MARK: Record<HealthCheck["state"], string> = {
  pass: "✓",
  warn: "!",
  fail: "✕",
  skip: "–",
};

export function HealthPanel({
  report,
  compact = false,
}: {
  report: HealthReport;
  compact?: boolean;
}) {
  const issues = report.checks.filter(
    (check) => check.state === "fail" || check.state === "warn",
  );

  return (
    <div className="flex flex-wrap items-start gap-6">
      <ProgressRing
        value={report.score}
        size={compact ? 88 : 112}
        thickness={compact ? 8 : 9}
        label={report.score}
        sublabel={report.grade}
      />
      <div className="flex min-w-[250px] flex-1 flex-col gap-2">
        {issues.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issues.map((check) => (
              <Badge
                key={check.id}
                tone={check.state === "fail" ? "bad" : "warn"}
                size="sm"
              >
                {check.label}
              </Badge>
            ))}
          </div>
        )}
        {!compact && (
          <ul className="flex flex-col gap-1.5">
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
        )}
        {compact && issues.length === 0 && (
          <p className="text-ink-2 text-[12.5px]">All health checks are passing.</p>
        )}
      </div>
    </div>
  );
}

export function HealthRing({
  score,
  grade,
  issues,
}: {
  score: number;
  grade: string;
  issues?: readonly { id: string; label: string; state: "fail" | "warn" }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ProgressRing
        value={score}
        size={96}
        thickness={8}
        label={score}
        sublabel={grade}
      />
      <div className="min-w-0 flex-1">
        {issues && issues.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {issues.map((issue) => (
              <Badge
                key={issue.id}
                tone={issue.state === "fail" ? "bad" : "warn"}
                size="sm"
              >
                {issue.label}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-ink-2 text-[12.5px]">No failing checks on master.</p>
        )}
      </div>
    </div>
  );
}
