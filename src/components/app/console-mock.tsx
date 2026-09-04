import { Funnel } from "@/components/app/funnel";
import { FreezeStamp } from "@/components/app/freeze-stamp";
import { cn } from "@/lib/utils";

/**
 * Static product demo for public pages. Same tokens as the signed-in console:
 * funnel conversion, locked master trunk, freeze stamp. Not a screenshot.
 */
export function ConsoleMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "console-grid console-glow bg-surface border-line overflow-hidden rounded-[var(--radius-xl)] border",
        className,
      )}
    >
      <div className="border-line bg-surface/90 flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="bg-primary size-2 rotate-45 rounded-[2px]" aria-hidden />
          <span className="font-display text-[13px] font-semibold">Today</span>
        </div>
        <span className="readout text-ink-3 text-[10px]">HUD · 2 urgent</span>
      </div>
      <div className="grid gap-3 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <p className="text-eyebrow">Funnel conversion</p>
          <Funnel
            stages={[
              { label: "Applied", count: 12, color: "var(--ink-3)" },
              { label: "Interview", count: 4, color: "var(--primary)" },
              { label: "Offer", count: 1, color: "var(--ok)" },
            ]}
          />
          <div className="border-line rounded-[var(--radius-md)] border px-3 py-2.5">
            <p className="text-eyebrow mb-2">Master trunk</p>
            <svg viewBox="0 0 280 72" className="text-ink-2 h-16 w-full" aria-hidden>
              <line x1="24" y1="12" x2="24" y2="64" stroke="var(--line-strong)" strokeWidth="2" />
              <circle cx="24" cy="16" r="5" fill="var(--primary)" />
              <text x="38" y="20" className="fill-ink text-[10px] font-semibold">
                Master · locked
              </text>
              <path
                d="M24 22 C 70 22, 70 48, 120 48"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.5"
              />
              <circle cx="120" cy="48" r="4.5" fill="var(--surface)" stroke="var(--primary)" />
              <text x="132" y="52" className="fill-ink-2 text-[10px]">
                Acme · backend
              </text>
            </svg>
          </div>
        </div>
        <FreezeStamp
          frozen
          at="2026-08-12T14:04:00.000Z"
          versionLabel="Acme backend v2"
          pages={1}
        />
      </div>
    </div>
  );
}
