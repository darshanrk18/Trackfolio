/**
 * LaTeX log hygiene.
 *
 * texlive.net returns the full transcript on failure. Almost all of it is
 * font/package chatter; the author's mistake is a `!` line near the end.
 * Truncating from the head (the naive approach) can drop the error entirely.
 */

export interface LatexError {
  /** Line in the submitted source, when the log reports one. */
  line?: number;
  message: string;
}

/** LaTeX logs run to megabytes; only the error region is useful for diagnosis. */
export const MAX_LOG_CHARS = 12_000;

/** Human hints for the mistakes resume authors actually make. */
export function annotateLatexError(message: string): string {
  const amp = String.raw`\&`;
  if (/Misplaced alignment tab character\s*&/i.test(message)) {
    return `${message} In LaTeX, & starts a table cell — write ${amp} for a literal ampersand (e.g. Frameworks ${amp} APIs).`;
  }
  if (/Missing \$ inserted/i.test(message)) {
    return `${message} A character TeX treats as math (often _) leaked into body text. Escape it, or wrap the math in $...$.`;
  }
  if (/Undefined control sequence/i.test(message)) {
    return `${message} That command is not defined — check the spelling, or load the package that provides it.`;
  }
  return message;
}

function sourceLocation(lines: string[], from: number): { line?: number; context: string } {
  for (let j = from; j < Math.min(from + 7, lines.length); j++) {
    const match = /^l\.(\d+)\s?(.*)$/.exec(lines[j] ?? "");
    if (!match) continue;
    return { line: Number(match[1]), context: (match[2] ?? "").trim() };
  }
  return { context: "" };
}

/**
 * Pulls the human-meaningful failures out of a LaTeX log.
 *
 * TeX reports errors as a line starting with `!`, with the offending source
 * line following a few lines later as `l.<number>`. Everything between is
 * internal macro trace that only confuses the author.
 */
export function extractLatexErrors(log: string): LatexError[] {
  const lines = log.split(/\r?\n/);
  const errors: LatexError[] = [];

  for (let i = 0; i < lines.length && errors.length < 20; i++) {
    const line = lines[i] ?? "";
    if (!line.startsWith("!")) continue;

    const message = line.replace(/^!\s*/, "").trim();
    if (!message) continue;

    const { line: sourceLine, context } = sourceLocation(lines, i + 1);
    const withContext = context ? `${message} — near: ${context}` : message;
    errors.push({
      line: sourceLine,
      message: annotateLatexError(withContext),
    });
  }

  if (errors.length === 0) {
    const fatal = lines.find((l) =>
      /Emergency stop|Fatal error|No pages of output|LaTeX Error/i.test(l),
    );
    if (fatal) errors.push({ message: annotateLatexError(fatal.trim()) });
  }

  return errors;
}

/** Keep the `!` error region; fall back to the tail if the log has no errors. */
export function trimLatexLog(log: string, max = MAX_LOG_CHARS): string {
  if (log.length <= max) return log;

  const match = /^!/m.exec(log);
  if (match?.index != null) {
    const fromError = log.slice(match.index);
    return fromError.length <= max ? fromError : fromError.slice(0, max);
  }

  return log.slice(-max);
}

/** Preview panel text: line-numbered errors first, then the trimmed transcript. */
export function formatCompileFailure(input: {
  log?: string | null;
  errors?: LatexError[] | null;
}): string {
  const errors = (input.errors ?? [])
    .map((error) =>
      error.line != null ? `Line ${error.line}: ${error.message}` : error.message,
    )
    .join("\n");
  return [errors, input.log].filter(Boolean).join("\n\n");
}
