/**
 * Apply AI tailor edits onto LaTeX source.
 *
 * The model is asked to quote `original` as a contiguous span of the source so
 * a replace is a locate, not a rewrite. Matching is exact first, then tolerant
 * of whitespace the model often collapses. Overlapping spans are skipped rather
 * than corrupting the document. Master is never written here — callers persist
 * the result onto a new branch.
 */

export interface ResumeEdit {
  original: string;
  revised: string;
}

export type ApplyEditStatus = "applied" | "missing" | "overlap" | "skipped";

export interface ApplyEditResult {
  index: number;
  status: ApplyEditStatus;
  /** Inclusive start of the matched span in the input source, when located. */
  start?: number;
  end?: number;
}

export interface ApplyEditsResult {
  source: string;
  applied: number;
  missing: number;
  results: ApplyEditResult[];
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** First span of `original` in `source`, or null if it cannot be located. */
export function locateSpan(
  source: string,
  original: string,
): { start: number; end: number } | null {
  const needle = original.trim();
  if (!needle) return null;

  const exact = source.indexOf(needle);
  if (exact >= 0) return { start: exact, end: exact + needle.length };

  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const match = new RegExp(tokens.map(escapeRegExp).join("\\s+")).exec(source);
  if (!match || match.index == null) return null;
  return { start: match.index, end: match.index + match[0].length };
}

/**
 * If the source escaped `&` / `%` / `$` in the matched span, keep that escaping
 * in the replacement so a compile that worked before the edit still works.
 */
export function preserveLatexEscapes(original: string, revised: string): string {
  let next = revised;
  if (original.includes("\\&")) next = next.replace(/(?<!\\)&/g, "\\&");
  if (original.includes("\\%")) next = next.replace(/(?<!\\)%/g, "\\%");
  if (original.includes("\\$")) next = next.replace(/(?<!\\)\$/g, "\\$");
  return next;
}

function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Apply a subset of edits. `selected` is a set of indexes into `edits`;
 * omitted means every edit is selected.
 */
export function applyResumeEdits(
  source: string,
  edits: readonly ResumeEdit[],
  selected?: ReadonlySet<number>,
): ApplyEditsResult {
  const located: Array<{ index: number; start: number; end: number; revised: string }> =
    [];
  const results: ApplyEditResult[] = edits.map((edit, index) => {
    if (selected && !selected.has(index)) {
      return { index, status: "skipped" };
    }
    const span = locateSpan(source, edit.original);
    if (!span) return { index, status: "missing" };
    located.push({
      index,
      ...span,
      revised: preserveLatexEscapes(source.slice(span.start, span.end), edit.revised),
    });
    return { index, status: "applied", start: span.start, end: span.end };
  });

  const accepted: typeof located = [];
  for (const item of located) {
    if (accepted.some((prior) => overlaps(prior, item))) {
      const row = results[item.index];
      if (row) row.status = "overlap";
      continue;
    }
    accepted.push(item);
  }

  accepted.sort((a, b) => b.start - a.start);
  let next = source;
  for (const item of accepted) {
    next = `${next.slice(0, item.start)}${item.revised}${next.slice(item.end)}`;
  }

  return {
    source: next,
    applied: results.filter((row) => row.status === "applied").length,
    missing: results.filter((row) => row.status === "missing").length,
    results,
  };
}
