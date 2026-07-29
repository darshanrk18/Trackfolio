import { describe, expect, it } from "vitest";
import {
  countWords,
  extractBullets,
  extractSections,
  isLatex,
  stripLatex,
} from "./latex";

describe("stripLatex", () => {
  it("returns empty string for empty input", () => {
    expect(stripLatex("")).toBe("");
  });

  it("unwraps nested formatting macros", () => {
    expect(stripLatex("\\textbf{\\underline{Senior Engineer}}")).toBe(
      "Senior Engineer",
    );
  });

  it("keeps the visible label of an href, not the URL", () => {
    const out = stripLatex(
      "\\href{https://github.com/example}{\\underline{github.com/example}}",
    );
    expect(out).toBe("github.com/example");
    expect(out).not.toContain("https://");
  });

  it("strips comments but preserves escaped percent signs", () => {
    // `\%` is a literal percent and must survive; `% note` is a comment.
    const out = stripLatex("Reduced latency by 30\\% % TODO verify number");
    expect(out).toContain("30%");
    expect(out).not.toContain("TODO");
  });

  it("drops preamble directives", () => {
    const out = stripLatex(
      "\\documentclass[10pt]{article}\n\\usepackage{geometry}\nDarshan Konnur",
    );
    expect(out.trim()).toBe("Darshan Konnur");
  });

  it("keeps arguments of unknown user-defined macros", () => {
    // `\resumeItem{...}` is user-defined; the prose inside must survive.
    expect(stripLatex("\\resumeItem{Built a distributed cache}")).toContain(
      "Built a distributed cache",
    );
  });

  it("removes math mode content", () => {
    expect(stripLatex("Speedup of $O(n \\log n)$ achieved")).toBe(
      "Speedup of achieved",
    );
  });

  it("drops verbatim environments entirely", () => {
    const out = stripLatex(
      "Before\n\\begin{verbatim}\nsecret code\n\\end{verbatim}\nAfter",
    );
    expect(out).not.toContain("secret code");
    expect(out).toContain("Before");
    expect(out).toContain("After");
  });

  it("handles unbalanced braces without throwing", () => {
    expect(() => stripLatex("\\textbf{unclosed")).not.toThrow();
  });

  it("passes plain text through unchanged", () => {
    expect(stripLatex("Just a normal sentence.")).toBe("Just a normal sentence.");
  });
});

describe("isLatex", () => {
  it("detects a LaTeX document", () => {
    expect(isLatex("\\documentclass{article}\\begin{document}x\\end{document}")).toBe(
      true,
    );
  });

  it("does not flag plain prose", () => {
    expect(isLatex("Dear hiring manager, I am writing to apply.")).toBe(false);
  });
});

describe("extractBullets", () => {
  it("extracts LaTeX \\item bullets", () => {
    const tex = `
\\begin{itemize}
  \\item Built a serverless pipeline using AWS Lambda and S3.
  \\item Reduced API latency by 30\\% through query optimization.
\\end{itemize}`;
    const bullets = extractBullets(tex);
    expect(bullets).toHaveLength(2);
    expect(bullets[0]).toContain("serverless pipeline");
    expect(bullets[1]).toContain("30%");
  });

  it("extracts markdown bullets when there is no LaTeX", () => {
    const md = "- Designed the schema\n- Shipped the API\n* Wrote the tests";
    expect(extractBullets(md)).toHaveLength(3);
  });

  it("returns an empty array when there are no bullets", () => {
    expect(extractBullets("A paragraph with no list.")).toEqual([]);
  });

  it("strips formatting inside bullets", () => {
    const bullets = extractBullets("\\item Used \\textbf{Kubernetes} at scale");
    expect(bullets[0]).toBe("Used Kubernetes at scale");
  });
});

describe("extractSections", () => {
  it("finds LaTeX section headings", () => {
    const tex = "\\section{Education}\\section{Technical Skills}\\section{Experience}";
    expect(extractSections(tex)).toEqual([
      "Education",
      "Technical Skills",
      "Experience",
    ]);
  });

  it("finds markdown headings", () => {
    expect(extractSections("# Experience\n## Education")).toEqual([
      "Experience",
      "Education",
    ]);
  });
});

describe("countWords", () => {
  it("counts only visible words", () => {
    expect(countWords("\\textbf{one} two three")).toBe(3);
  });

  it("ignores macro names", () => {
    expect(countWords("\\usepackage{geometry}\nhello world")).toBe(2);
  });
});
