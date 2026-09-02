import { describe, expect, it } from "vitest";
import {
  applyResumeEdits,
  locateSpan,
  preserveLatexEscapes,
} from "./apply-edits";

const SOURCE = String.raw`\section{Experience}
\item Built APIs in TypeScript on PostgreSQL.
\item Cloud \& Infrastructure work with Docker.
\end{document}
`;

describe("locateSpan", () => {
  it("finds an exact LaTeX span", () => {
    expect(locateSpan(SOURCE, "Built APIs in TypeScript on PostgreSQL.")).toEqual({
      start: SOURCE.indexOf("Built APIs"),
      end: SOURCE.indexOf("Built APIs") + "Built APIs in TypeScript on PostgreSQL.".length,
    });
  });

  it("tolerates collapsed whitespace", () => {
    const span = locateSpan(SOURCE, "Built APIs  in   TypeScript on PostgreSQL.");
    expect(span).not.toBeNull();
    expect(SOURCE.slice(span!.start, span!.end)).toBe(
      "Built APIs in TypeScript on PostgreSQL.",
    );
  });

  it("returns null when the span is not in the source", () => {
    expect(locateSpan(SOURCE, "Invented a quantum compiler.")).toBeNull();
  });
});

describe("preserveLatexEscapes", () => {
  it("re-escapes ampersands when the original span used \\&", () => {
    expect(preserveLatexEscapes(String.raw`Cloud \& Infrastructure`, "Cloud & Platform")).toBe(
      String.raw`Cloud \& Platform`,
    );
  });
});

describe("applyResumeEdits", () => {
  it("replaces selected spans and leaves the rest", () => {
    const result = applyResumeEdits(SOURCE, [
      {
        original: "Built APIs in TypeScript on PostgreSQL.",
        revised: "Built REST APIs in TypeScript on PostgreSQL.",
      },
    ]);
    expect(result.applied).toBe(1);
    expect(result.source).toContain("Built REST APIs in TypeScript on PostgreSQL.");
    expect(result.source).toContain(String.raw`Cloud \& Infrastructure`);
  });

  it("skips unselected edits", () => {
    const result = applyResumeEdits(
      SOURCE,
      [
        {
          original: "Built APIs in TypeScript on PostgreSQL.",
          revised: "should not land",
        },
      ],
      new Set(),
    );
    expect(result.applied).toBe(0);
    expect(result.results[0]?.status).toBe("skipped");
    expect(result.source).toBe(SOURCE);
  });

  it("marks a missing original instead of inventing a splice", () => {
    const result = applyResumeEdits(SOURCE, [
      { original: "Led a team of 40", revised: "Led a team of 40 engineers" },
    ]);
    expect(result.applied).toBe(0);
    expect(result.missing).toBe(1);
    expect(result.source).toBe(SOURCE);
  });

  it("applies two non-overlapping edits", () => {
    const result = applyResumeEdits(SOURCE, [
      {
        original: "Built APIs in TypeScript on PostgreSQL.",
        revised: "A",
      },
      {
        original: String.raw`Cloud \& Infrastructure work with Docker.`,
        revised: String.raw`Cloud \& Infrastructure work with Docker and Kubernetes.`,
      },
    ]);
    expect(result.applied).toBe(2);
    expect(result.source).toContain("\\item A\n");
    expect(result.source).toContain("Docker and Kubernetes");
  });

  it("drops an overlapping second edit rather than corrupting the file", () => {
    const result = applyResumeEdits(SOURCE, [
      {
        original: "Built APIs in TypeScript on PostgreSQL.",
        revised: "ONE",
      },
      {
        original: "Built APIs in TypeScript",
        revised: "TWO",
      },
    ]);
    expect(result.results.map((row) => row.status)).toEqual(["applied", "overlap"]);
    expect(result.source).toContain("\\item ONE\n");
    expect(result.source).not.toContain("TWO");
  });
});
