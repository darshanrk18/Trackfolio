/**
 * LaTeX → plain text extraction.
 *
 * The original prototype stripped LaTeX with a fixed number of regex passes,
 * which silently mangled nested macros (`\textbf{\underline{x}}`) and treated
 * escaped percent signs as comments. This implementation walks the source
 * character by character, so nesting depth and escaping are handled correctly.
 */

/** Macros whose entire line is layout configuration and carries no prose. */
const PREAMBLE_MACROS = new Set([
  "documentclass",
  "usepackage",
  "newcommand",
  "renewcommand",
  "providecommand",
  "declarerobustcommand",
  "titleformat",
  "titlespacing",
  "setlist",
  "setlength",
  "addtolength",
  "pagestyle",
  "thispagestyle",
  "urlstyle",
  "geometry",
  "definecolor",
  "hypersetup",
  "input",
  "include",
  "bibliographystyle",
  "bibliography",
  "newenvironment",
  "renewenvironment",
  "counterwithin",
  "setcounter",
  "newcolumntype",
  "fancyhf",
  "titlerule",
]);

/**
 * Macros that wrap visible content: the braced argument is prose and should be
 * preserved while the macro name itself is dropped.
 */
const TEXT_MACROS = new Set([
  "textbf",
  "textit",
  "texttt",
  "textsc",
  "textrm",
  "textsf",
  "textmd",
  "textup",
  "textsl",
  "textnormal",
  "emph",
  "underline",
  "uline",
  "sout",
  "mbox",
  "hbox",
  "text",
  "small",
  "footnotesize",
  "scriptsize",
  "large",
  "Large",
  "LARGE",
  "huge",
  "Huge",
  "normalsize",
  "scshape",
  "bfseries",
  "itshape",
  "centering",
  "raggedright",
  "raggedleft",
  "item",
  "section",
  "subsection",
  "subsubsection",
  "paragraph",
  "title",
  "author",
  "date",
]);

/**
 * Macros where the *last* braced argument is the visible text and any earlier
 * arguments are metadata (URLs, labels, keys).
 */
const LAST_ARG_MACROS = new Set(["href", "hyperref", "url", "cite", "ref", "footnote"]);

/** Environments whose body should be dropped entirely. */
const DROPPED_ENVIRONMENTS = new Set(["comment", "verbatim", "lstlisting", "tikzpicture"]);

/** Macros that expand to whitespace or a simple glyph. */
const GLYPH_MACROS: Record<string, string> = {
  "&": "&",
  "%": "%",
  $: "$",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
  ldots: "…",
  dots: "…",
  textbar: "|",
  textbackslash: "\\",
  quad: " ",
  qquad: " ",
  hfill: " ",
  vfill: " ",
  newline: "\n",
  "\\": "\n",
  bullet: "•",
  cdot: "·",
  times: "×",
  degree: "°",
  copyright: "©",
  ampersand: "&",
  nbsp: " ",
  " ": " ",
  ",": " ",
  ";": " ",
  ":": " ",
  "!": "",
};

interface ParseState {
  src: string;
  i: number;
  out: string[];
  /**
   * Whether `%` starts a comment. Only true for real LaTeX — in a plain-text or
   * markdown resume "reduced spend by 30%" must keep everything after the sign.
   */
  comments: boolean;
}

function isLetter(ch: string | undefined): boolean {
  return ch !== undefined && ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z"));
}

/** Reads a `\macroName` starting at a backslash; returns the name and new index. */
function readMacroName(src: string, i: number): { name: string; next: number } {
  // i points at the backslash.
  let j = i + 1;
  if (!isLetter(src[j])) {
    // Single-character control symbol such as `\&` or `\\`.
    return { name: src[j] ?? "", next: j + 1 };
  }
  while (isLetter(src[j])) j++;
  // A trailing `*` is part of the macro name (e.g. `\section*`).
  if (src[j] === "*") j++;
  return { name: src.slice(i + 1, j), next: j };
}

/** Skips whitespace and returns the index of the next non-space character. */
function skipSpace(src: string, i: number): number {
  while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
  return i;
}

/**
 * Reads a balanced `{...}` group starting at `i` (which must point at `{`).
 * Returns the raw inner content and the index just past the closing brace.
 */
function readGroup(src: string, i: number): { body: string; next: number } | null {
  if (src[i] !== "{") return null;
  let depth = 0;
  let j = i;
  while (j < src.length) {
    const ch = src[j];
    if (ch === "\\") {
      j += 2; // Skip escaped character.
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { body: src.slice(i + 1, j), next: j + 1 };
    }
    j++;
  }
  // Unbalanced: treat the remainder as the body rather than throwing, since
  // users routinely paste partial documents.
  return { body: src.slice(i + 1), next: src.length };
}

/** Reads all consecutive `{...}` arguments following a macro. */
function readArgs(src: string, i: number): { args: string[]; next: number } {
  const args: string[] = [];
  let j = i;
  for (;;) {
    const k = skipSpace(src, j);
    // Optional `[...]` arguments are metadata; skip them.
    if (src[k] === "[") {
      const close = src.indexOf("]", k);
      if (close === -1) break;
      j = close + 1;
      continue;
    }
    const group = readGroup(src, k);
    if (!group) break;
    args.push(group.body);
    j = group.next;
  }
  return { args, next: j };
}

function emit(state: ParseState, text: string): void {
  if (text) state.out.push(text);
}

function walk(src: string, comments: boolean): string {
  const state: ParseState = { src, i: 0, out: [], comments };

  while (state.i < src.length) {
    const ch = src[state.i]!;

    // --- Comments: `%` to end of line, unless escaped as `\%`. --------------
    if (ch === "%" && state.comments) {
      const nl = src.indexOf("\n", state.i);
      state.i = nl === -1 ? src.length : nl + 1;
      emit(state, "\n");
      continue;
    }

    // --- Math mode: keep nothing but a space placeholder. -------------------
    if (ch === "$") {
      const isDisplay = src[state.i + 1] === "$";
      const delim = isDisplay ? "$$" : "$";
      const end = src.indexOf(delim, state.i + delim.length);
      state.i = end === -1 ? src.length : end + delim.length;
      emit(state, " ");
      continue;
    }

    if (ch === "\\") {
      const { name, next } = readMacroName(src, state.i);

      // `\begin{env}` / `\end{env}`
      if (name === "begin" || name === "end") {
        const group = readGroup(src, skipSpace(src, next));
        const envName = group?.body.trim() ?? "";
        let after = group?.next ?? next;

        if (name === "begin" && DROPPED_ENVIRONMENTS.has(envName)) {
          const endMarker = `\\end{${envName}}`;
          const endIdx = src.indexOf(endMarker, after);
          state.i = endIdx === -1 ? src.length : endIdx + endMarker.length;
          emit(state, "\n");
          continue;
        }
        // `\begin{itemize}[leftmargin=...]` — drop the optional argument.
        after = skipSpace(src, after);
        if (src[after] === "[") {
          const close = src.indexOf("]", after);
          if (close !== -1) after = close + 1;
        }
        state.i = after;
        emit(state, "\n");
        continue;
      }

      // Whole-line preamble directives.
      if (PREAMBLE_MACROS.has(name)) {
        const nl = src.indexOf("\n", state.i);
        state.i = nl === -1 ? src.length : nl + 1;
        emit(state, "\n");
        continue;
      }

      // Glyph and spacing macros.
      if (Object.prototype.hasOwnProperty.call(GLYPH_MACROS, name)) {
        emit(state, GLYPH_MACROS[name]!);
        state.i = next;
        continue;
      }

      // `\item` introduces a bullet; mark it so bullets can be recovered later.
      if (name === "item") {
        emit(state, "\n\u0001 ");
        let after = skipSpace(src, next);
        if (src[after] === "[") {
          const close = src.indexOf("]", after);
          if (close !== -1) after = close + 1;
        }
        state.i = after;
        continue;
      }

      const { args, next: afterArgs } = readArgs(src, next);

      if (LAST_ARG_MACROS.has(name)) {
        const visible = args.length > 0 ? args[args.length - 1]! : "";
        emit(state, walk(visible, state.comments));
        state.i = afterArgs;
        continue;
      }

      if (TEXT_MACROS.has(name)) {
        // Section-like macros should read as their own line.
        const isBlock = /^(sub)*section$|^paragraph$|^title$/.test(name);
        if (isBlock) emit(state, "\n");
        for (const arg of args) emit(state, walk(arg, state.comments));
        if (isBlock) emit(state, "\n");
        state.i = afterArgs;
        continue;
      }

      // Unknown macro: drop the name but keep the arguments, which are usually
      // user-defined wrappers like `\resumeItem{...}` around real prose.
      if (args.length > 0) {
        for (const arg of args) {
          emit(state, walk(arg, state.comments));
          emit(state, " ");
        }
      } else {
        emit(state, " ");
      }
      state.i = afterArgs;
      continue;
    }

    if (ch === "{" || ch === "}") {
      state.i++;
      continue;
    }

    if (ch === "~") {
      emit(state, " ");
      state.i++;
      continue;
    }

    emit(state, ch);
    state.i++;
  }

  return state.out.join("");
}

/** Marker inserted at each `\item`, used by {@link extractBullets}. */
const BULLET_MARK = "\u0001";

export interface StripOptions {
  /** Keep the internal bullet markers (used internally by bullet extraction). */
  keepBulletMarks?: boolean;
}

/**
 * Converts LaTeX source into readable plain text.
 *
 * Non-LaTeX input passes through essentially unchanged, so the same function
 * works for markdown and plain-text resumes.
 */
export function stripLatex(source: string, options: StripOptions = {}): string {
  if (!source) return "";
  const walked = walk(source, isLatex(source));
  const cleaned = walked
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return options.keepBulletMarks ? cleaned : cleaned.split(BULLET_MARK).join("");
}

/** True when the source looks like LaTeX rather than prose. */
export function isLatex(source: string): boolean {
  if (!source) return false;
  return (
    /\\documentclass|\\begin\{document\}|\\section\{|\\item\b|\\textbf\{|\\%/.test(
      source,
    ) || (source.match(/\\[a-zA-Z]{2,}/g)?.length ?? 0) >= 5
  );
}

/**
 * Extracts resume bullet points.
 *
 * Handles LaTeX `\item`, markdown list markers, and unicode bullets so the
 * analysis engine works regardless of the source format.
 */
export function extractBullets(source: string): string[] {
  if (!source) return [];
  const bullets: string[] = [];

  if (isLatex(source)) {
    const text = stripLatex(source, { keepBulletMarks: true });
    for (const chunk of text.split(BULLET_MARK).slice(1)) {
      // A bullet runs until the next blank line or section break.
      const bullet = chunk.split(/\n\s*\n/)[0]!.replace(/\s+/g, " ").trim();
      if (bullet) bullets.push(bullet);
    }
  }

  if (bullets.length === 0) {
    for (const line of source.split("\n")) {
      const match = line.match(/^\s*(?:[-*+\u2022\u2023\u25E6\u2043]|\d+[.)])\s+(.+)$/);
      if (match?.[1]) {
        const bullet = stripLatex(match[1]).replace(/\s+/g, " ").trim();
        if (bullet) bullets.push(bullet);
      }
    }
  }

  return bullets;
}

/** Section headings detected in the document, in order of appearance. */
export function extractSections(source: string): string[] {
  const sections: string[] = [];
  const latexSection = /\\(?:sub)*section\*?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = latexSection.exec(source)) !== null) {
    const group = readGroup(source, match.index + match[0].length - 1);
    if (group) {
      const title = stripLatex(group.body).replace(/\s+/g, " ").trim();
      if (title) sections.push(title);
    }
  }
  if (sections.length === 0) {
    for (const line of source.split("\n")) {
      const md = line.match(/^\s*#{1,3}\s+(.+?)\s*$/);
      if (md?.[1]) {
        sections.push(md[1].trim());
        continue;
      }
      // ALL CAPS heading line, a common plain-text resume convention.
      const trimmed = line.trim();
      if (
        trimmed.length >= 3 &&
        trimmed.length <= 40 &&
        /^[A-Z][A-Z\s&/]+$/.test(trimmed)
      ) {
        sections.push(trimmed);
      }
    }
  }
  return sections;
}

/** Words in the visible text, excluding LaTeX control sequences. */
export function countWords(source: string): number {
  const plain = stripLatex(source);
  return (plain.match(/[A-Za-z][A-Za-z0-9'’+#.-]*/g) ?? []).length;
}
