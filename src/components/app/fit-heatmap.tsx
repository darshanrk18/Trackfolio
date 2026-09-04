import type { MatchResult, RequirementTier } from "@/lib/analysis/keywords";
import { cn } from "@/lib/utils";

const TIERS: { id: RequirementTier; label: string }[] = [
  { id: "must", label: "Must" },
  { id: "preferred", label: "Preferred" },
  { id: "other", label: "Other" },
];

/**
 * Two-axis board: must / preferred / other × present / missing.
 * Missing cells stay empty. Never fill them with invented keywords.
 */
export function FitHeatmap({ match }: { match: MatchResult }) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[520px] grid-cols-[88px_1fr_1fr] gap-1.5">
        <div />
        <p className="text-eyebrow px-1">Present in resume</p>
        <p className="text-eyebrow px-1">Missing evidence</p>
        {TIERS.map((tier) => {
          const rows = match[tier.id];
          const present = rows.filter((term) => term.present);
          const missing = rows.filter((term) => !term.present);
          return (
            <HeatRow
              key={tier.id}
              label={tier.label}
              present={present.map((term) => term.term)}
              missing={missing.map((term) => term.term)}
              emptyHint={
                rows.length === 0
                  ? "No terms in this tier"
                  : missing.length === 0
                    ? "Nothing missing"
                    : "Empty on purpose — do not invent these"
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function HeatRow({
  label,
  present,
  missing,
  emptyHint,
}: {
  label: string;
  present: string[];
  missing: string[];
  emptyHint: string;
}) {
  return (
    <>
      <p className="readout text-ink-2 self-start pt-2 text-[10px] font-semibold uppercase">
        {label}
      </p>
      <Cell tone="ok" terms={present} empty="No matches in this tier" />
      <Cell tone="bad" terms={missing} empty={emptyHint} dashed />
    </>
  );
}

function Cell({
  tone,
  terms,
  empty,
  dashed,
}: {
  tone: "ok" | "bad";
  terms: string[];
  empty: string;
  dashed?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-[72px] rounded-[var(--radius-md)] border px-2.5 py-2",
        tone === "ok" && "border-ok-border bg-ok-soft/40",
        tone === "bad" && "border-bad-border bg-bad-soft/20",
        dashed && "border-dashed",
      )}
    >
      {terms.length === 0 ? (
        <p className="text-ink-3 text-[11.5px]">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {terms.map((term) => (
            <li
              key={term}
              className={cn(
                "rounded-[4px] px-1.5 py-0.5 font-mono text-[10.5px]",
                tone === "ok" && "bg-ok-soft text-ok",
                tone === "bad" && "text-ink-2 border-line border border-dashed bg-transparent",
              )}
            >
              {term}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
