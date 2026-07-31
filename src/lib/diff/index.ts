/**
 * Text diffing.
 *
 * The prototype used a full O(n·m) dynamic-programming table, which allocates
 * ~4 GB for two 1,000-line documents and locks the UI thread. This uses Myers'
 * O((N+M)·D) algorithm with common prefix/suffix trimming, so realistic resume
 * edits (a handful of changed lines) run in microseconds.
 */

export type DiffOpType = "equal" | "insert" | "delete";

export interface DiffOp {
  type: DiffOpType;
  value: string;
  /** Line number in the original document, 1-based. Undefined for inserts. */
  oldIndex?: number;
  /** Line number in the new document, 1-based. Undefined for deletes. */
  newIndex?: number;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
  /** Fraction of the original that survived, 0–1. */
  similarity: number;
}

export interface DiffResult {
  ops: DiffOp[];
  stats: DiffStats;
}

/**
 * Myers diff over arbitrary token arrays.
 *
 * Returns a script of equal/insert/delete operations against the token indices.
 */
function myers<T>(a: readonly T[], b: readonly T[]): DiffOp[] {
  const n = a.length;
  const m = b.length;

  // --- Trim the common prefix and suffix ---------------------------------
  let start = 0;
  while (start < n && start < m && a[start] === b[start]) start++;

  let endA = n;
  let endB = m;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const ops: DiffOp[] = [];
  for (let i = 0; i < start; i++) {
    ops.push({ type: "equal", value: String(a[i]), oldIndex: i + 1, newIndex: i + 1 });
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const middle = myersCore(midA, midB);

  let oldCursor = start;
  let newCursor = start;
  for (const op of middle) {
    if (op.type === "equal") {
      ops.push({
        type: "equal",
        value: op.value,
        oldIndex: ++oldCursor,
        newIndex: ++newCursor,
      });
    } else if (op.type === "delete") {
      ops.push({ type: "delete", value: op.value, oldIndex: ++oldCursor });
    } else {
      ops.push({ type: "insert", value: op.value, newIndex: ++newCursor });
    }
  }

  for (let i = 0; i < n - endA; i++) {
    ops.push({
      type: "equal",
      value: String(a[endA + i]),
      oldIndex: endA + i + 1,
      newIndex: endB + i + 1,
    });
  }

  return ops;
}

/** Core Myers algorithm without trimming; operates on the differing middle. */
function myersCore<T>(a: readonly T[], b: readonly T[]): DiffOp[] {
  const n = a.length;
  const m = b.length;

  if (n === 0) return b.map((v) => ({ type: "insert" as const, value: String(v) }));
  if (m === 0) return a.map((v) => ({ type: "delete" as const, value: String(v) }));

  const max = n + m;
  const offset = max;
  // `v[k + offset]` = furthest x reached on diagonal k.
  const v = new Int32Array(2 * max + 1);
  /** Snapshot of `v` after each D, used to walk the path backwards. */
  const trace: Int32Array[] = [];

  let found = -1;
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      // Choose whether we arrived here by moving down (insert) or right (delete).
      if (k === -d || (k !== d && v[k - 1 + offset]! < v[k + 1 + offset]!)) {
        x = v[k + 1 + offset]!; // down → insertion from b
      } else {
        x = v[k - 1 + offset]! + 1; // right → deletion from a
      }
      let y = x - k;
      // Follow the diagonal (matching tokens) as far as possible.
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[k + offset] = x;
      if (x >= n && y >= m) {
        found = d;
        break outer;
      }
    }
  }

  if (found === -1) {
    // Should be unreachable; degrade gracefully rather than throwing.
    return [
      ...a.map((val) => ({ type: "delete" as const, value: String(val) })),
      ...b.map((val) => ({ type: "insert" as const, value: String(val) })),
    ];
  }

  // --- Backtrack ----------------------------------------------------------
  const ops: DiffOp[] = [];
  let x = n;
  let y = m;

  for (let d = found; d > 0; d--) {
    const prev = trace[d]!;
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && prev[k - 1 + offset]! < prev[k + 1 + offset]!)) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = prev[prevK + offset]!;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ type: "equal", value: String(a[x - 1]) });
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) {
        ops.push({ type: "insert", value: String(b[y - 1]) });
        y--;
      } else {
        ops.push({ type: "delete", value: String(a[x - 1]) });
        x--;
      }
    }
  }

  while (x > 0 && y > 0) {
    ops.push({ type: "equal", value: String(a[x - 1]) });
    x--;
    y--;
  }
  while (x > 0) {
    ops.push({ type: "delete", value: String(a[--x]) });
  }
  while (y > 0) {
    ops.push({ type: "insert", value: String(b[--y]) });
  }

  return ops.reverse();
}

function computeStats(ops: readonly DiffOp[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const op of ops) {
    if (op.type === "insert") added++;
    else if (op.type === "delete") removed++;
    else unchanged++;
  }
  const total = unchanged + added + removed;
  return {
    added,
    removed,
    unchanged,
    similarity: total === 0 ? 1 : Number((unchanged / total).toFixed(4)),
  };
}

/** Line-level diff. */
export function diffLines(before: string, after: string): DiffResult {
  const a = (before ?? "").split("\n");
  const b = (after ?? "").split("\n");
  const ops = myers(a, b);
  return { ops, stats: computeStats(ops) };
}

/** Splits into words while preserving whitespace as its own token. */
function tokenizeWords(text: string): string[] {
  return (text ?? "").match(/\s+|[^\s]+/g) ?? [];
}

/** Word-level diff, better for prose such as cover letters. */
export function diffWords(before: string, after: string): DiffResult {
  const a = tokenizeWords(before);
  const b = tokenizeWords(after);
  const ops = myers(a, b);
  // Whitespace-only changes are noise; fold them into the surrounding context.
  const meaningful = ops.filter(
    (op) => op.type === "equal" || op.value.trim().length > 0,
  );
  return { ops, stats: computeStats(meaningful) };
}

export type DiffGranularity = "line" | "word";

export function diff(
  before: string,
  after: string,
  granularity: DiffGranularity = "line",
): DiffResult {
  return granularity === "word" ? diffWords(before, after) : diffLines(before, after);
}

/**
 * Groups a line diff into hunks with surrounding context, so the UI can show
 * only what changed instead of the whole document.
 */
export interface DiffHunk {
  ops: DiffOp[];
  oldStart: number;
  newStart: number;
}

function firstDefinedIndex(
  ops: readonly DiffOp[],
  from: number,
  key: "oldIndex" | "newIndex",
): number {
  for (let k = from; k < ops.length; k++) {
    const value = ops[k]![key];
    if (value != null) return value;
  }
  for (let k = from - 1; k >= 0; k--) {
    const value = ops[k]![key];
    if (value != null) return value + 1;
  }
  return 1;
}

export function toHunks(ops: readonly DiffOp[], context = 3): DiffHunk[] {
  const changed = new Set<number>();
  ops.forEach((op, i) => {
    if (op.type !== "equal") {
      for (let j = Math.max(0, i - context); j <= Math.min(ops.length - 1, i + context); j++) {
        changed.add(j);
      }
    }
  });
  if (changed.size === 0) return [];

  const hunks: DiffHunk[] = [];
  let current: DiffOp[] = [];
  let hunkStartOld = 1;
  let hunkStartNew = 1;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    if (changed.has(i)) {
      if (current.length === 0) {
        hunkStartOld = op.oldIndex ?? firstDefinedIndex(ops, i, "oldIndex");
        hunkStartNew = op.newIndex ?? firstDefinedIndex(ops, i, "newIndex");
      }
      current.push(op);
    } else if (current.length > 0) {
      hunks.push({ ops: current, oldStart: hunkStartOld, newStart: hunkStartNew });
      current = [];
    }
  }
  if (current.length > 0) {
    hunks.push({ ops: current, oldStart: hunkStartOld, newStart: hunkStartNew });
  }
  return hunks;
}

/** Similarity ratio between two strings, 0–1. Used to detect near-duplicates. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  return diffLines(a, b).stats.similarity;
}
