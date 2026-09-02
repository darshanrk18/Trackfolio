import { describe, expect, it } from "vitest";
import {
  annotateLatexError,
  extractLatexErrors,
  formatCompileFailure,
  trimLatexLog,
} from "./latex-log";

const REAL_FAILURE = `
LaTeX Font Info:    External font \`cmex10' loaded for size
(Font)              <5> on input line 67.

! Misplaced alignment tab character &.
<argument> Frameworks &
                        APIs:
l.98 ...React, Redux, Next.js, REST APIs, Postman}

?
! Emergency stop.
<argument> Frameworks &
                        APIs:
l.98 ...React, Redux, Next.js, REST APIs, Postman}

!  ==> Fatal error occurred, no output PDF file produced!
`;

describe("extractLatexErrors", () => {
  it("pulls the source line out of a texlive.net transcript", () => {
    const errors = extractLatexErrors(REAL_FAILURE);
    expect(errors[0]?.line).toBe(98);
    expect(errors[0]?.message).toMatch(/Misplaced alignment tab character &/i);
    expect(errors[0]?.message).toMatch(/\\&/);
  });

  it("falls back to a fatal line when no ! error is present", () => {
    const errors = extractLatexErrors("No pages of output.\nTranscript written on document.log.");
    expect(errors).toEqual([{ message: "No pages of output." }]);
  });
});

describe("trimLatexLog", () => {
  it("keeps the error region when the head would otherwise eat the budget", () => {
    const head = "font loading noise\n".repeat(2_000);
    const trimmed = trimLatexLog(`${head}! Misplaced alignment tab character &.\nl.98 foo\n`, 500);
    expect(trimmed.startsWith("! Misplaced")).toBe(true);
    expect(trimmed).toContain("l.98 foo");
    expect(trimmed.length).toBeLessThanOrEqual(500);
  });

  it("keeps a short log untouched", () => {
    expect(trimLatexLog("short")).toBe("short");
  });
});

describe("annotateLatexError", () => {
  it("explains a raw ampersand", () => {
    expect(annotateLatexError("Misplaced alignment tab character &.")).toMatch(
      /Frameworks \\& APIs/,
    );
  });
});

describe("formatCompileFailure", () => {
  it("leads with the line-numbered error", () => {
    const text = formatCompileFailure({
      errors: [{ line: 98, message: "Misplaced alignment tab character &." }],
      log: "! Misplaced alignment tab character &.",
    });
    expect(text.startsWith("Line 98:")).toBe(true);
  });
});
