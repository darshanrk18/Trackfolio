/**
 * Session-scoped resume source.
 *
 * Analyze, Assistant, and any other view that scores or rewrites a resume
 * should read this instead of assuming master. Master remains the default and
 * is never written by those views.
 */

export const RESUME_SOURCE_KEY = "trackfolio:resume-source";

const listeners = new Set<() => void>();
let cached: string | null | undefined;

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  if (cached === undefined) {
    cached = sessionStorage.getItem(RESUME_SOURCE_KEY);
  }
  return cached;
}

export function setResumeSourceId(id: string | null) {
  cached = id;
  if (typeof window !== "undefined") {
    if (id) sessionStorage.setItem(RESUME_SOURCE_KEY, id);
    else sessionStorage.removeItem(RESUME_SOURCE_KEY);
  }
  listeners.forEach((listener) => listener());
}

/** Client snapshot for `useSyncExternalStore`. Server snapshot is always null. */
export const resumeSourceStore = {
  subscribe,
  getSnapshot: readStored,
  getServerSnapshot: () => null,
};

export function formatBranchOption(branch: {
  isMaster: boolean;
  name: string;
  company?: string | null;
  role?: string | null;
}): string {
  const prefix = branch.isMaster ? "MASTER · " : "";
  const extra = [branch.company, branch.role].filter(Boolean).join(" · ");
  if (extra && extra !== branch.name) return `${prefix}${branch.name} — ${extra}`;
  return `${prefix}${branch.name}`;
}
