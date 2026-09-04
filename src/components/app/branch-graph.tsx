"use client";

import { cn } from "@/lib/utils";

export interface GraphVersion {
  id: string;
  branchId: string | null;
  createdAt: Date | string;
  note: string | null;
  revision: number;
}

export interface GraphBranch {
  id: string;
  name: string;
  isMaster: boolean;
  company: string | null;
  role: string | null;
}

/**
 * Master as a locked trunk; company branches as named tips; versions as dots
 * on the line. Clicking a tip loads that branch.
 */
export function BranchGraph({
  branches,
  versions,
  activeId,
  onSelect,
  className,
}: {
  branches: readonly GraphBranch[];
  versions: readonly GraphVersion[];
  activeId?: string | null;
  onSelect?: (branchId: string) => void;
  className?: string;
}) {
  const master = branches.find((b) => b.isMaster) ?? branches[0];
  const tips = branches.filter((b) => !b.isMaster);
  const rowH = 36;
  const padX = 28;
  const padY = 22;
  const trunkX = 36;
  const width = Math.max(420, 220 + tips.length * 12);
  const height = padY * 2 + Math.max(1, tips.length + 1) * rowH;

  const versionsByBranch = new Map<string, GraphVersion[]>();
  for (const version of versions) {
    if (!version.branchId) continue;
    const list = versionsByBranch.get(version.branchId) ?? [];
    list.push(version);
    versionsByBranch.set(version.branchId, list);
  }
  for (const list of versionsByBranch.values()) {
    list.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  return (
    <div className={cn("bg-sunken border-line overflow-x-auto rounded-[var(--radius-md)] border", className)}>
      <svg
        role="img"
        aria-label="Resume branch graph. Master is the locked trunk; company branches are named tips."
        width={width}
        height={height}
        className="block min-w-full"
      >
        {master && (
          <>
            <line
              x1={trunkX}
              y1={padY}
              x2={trunkX}
              y2={height - padY}
              stroke="var(--line-strong)"
              strokeWidth="2"
            />
            <circle
              cx={trunkX}
              cy={padY}
              r={activeId === master.id ? 7 : 6}
              fill="var(--primary)"
              className="cursor-pointer"
              onClick={() => onSelect?.(master.id)}
            />
            <g transform={`translate(${trunkX - 5}, ${padY - 18})`} className="fill-none stroke-primary">
              <rect x="1.5" y="4.5" width="7" height="5.5" rx="0.8" strokeWidth="1.2" />
              <path d="M3 4.5V3.2a2 2 0 0 1 4 0V4.5" strokeWidth="1.2" />
            </g>
            <text
              x={trunkX + 14}
              y={padY + 4}
              className="fill-ink font-sans text-[11px] font-semibold"
            >
              {master.name} · locked
            </text>
            <VersionDots
              versions={versionsByBranch.get(master.id) ?? []}
              x={trunkX + 28}
              y={padY + 16}
            />
          </>
        )}

        {tips.map((branch, index) => {
          const y = padY + (index + 1) * rowH;
          const tipX = Math.min(width - padX, 160 + index * 18);
          const active = activeId === branch.id;
          return (
            <g
              key={branch.id}
              className="cursor-pointer"
              onClick={() => onSelect?.(branch.id)}
            >
              <path
                d={`M ${trunkX} ${padY + 8} C ${trunkX + 40} ${padY + 8}, ${trunkX + 40} ${y}, ${tipX} ${y}`}
                fill="none"
                stroke={active ? "var(--primary)" : "var(--line-2)"}
                strokeWidth={active ? 2 : 1.5}
              />
              <circle
                cx={tipX}
                cy={y}
                r={active ? 6 : 5}
                fill={active ? "var(--primary)" : "var(--surface)"}
                stroke="var(--primary)"
                strokeWidth="1.5"
              />
              <text
                x={tipX + 12}
                y={y + 4}
                className={cn(
                  "font-sans text-[11px]",
                  active ? "fill-primary-ink font-semibold" : "fill-ink-2",
                )}
              >
                {branch.company || branch.name}
                {branch.role ? ` · ${branch.role}` : ""}
              </text>
              <VersionDots
                versions={versionsByBranch.get(branch.id) ?? []}
                x={trunkX + 48}
                y={y - 10}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function VersionDots({
  versions,
  x,
  y,
}: {
  versions: GraphVersion[];
  x: number;
  y: number;
}) {
  const shown = versions.slice(-8);
  return (
    <g>
      {shown.map((version, index) => (
        <circle
          key={version.id}
          cx={x + index * 10}
          cy={y}
          r={2.5}
          fill="var(--ink-3)"
        >
          <title>{version.note || `v${version.revision}`}</title>
        </circle>
      ))}
    </g>
  );
}
