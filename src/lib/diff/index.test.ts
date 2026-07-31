import { describe, expect, it } from "vitest";
import {
  diff,
  diffLines,
  diffWords,
  similarity,
  toHunks,
  type DiffOp,
} from "./index";

/** The ops describing the original document: everything except insertions. */
function rebuildOld(ops: readonly DiffOp[], join: string): string {
  return ops
    .filter((op) => op.type !== "insert")
    .map((op) => op.value)
    .join(join);
}

/** The ops describing the new document: everything except deletions. */
function rebuildNew(ops: readonly DiffOp[], join: string): string {
  return ops
    .filter((op) => op.type !== "delete")
    .map((op) => op.value)
    .join(join);
}

/**
 * Both sides of the diff must be losslessly reconstructible from the op list.
 * Every other property of a diff is cosmetic next to this one.
 */
function expectRoundTrip(before: string, after: string, join = "\n"): DiffOp[] {
  const { ops } = join === "\n" ? diffLines(before, after) : diffWords(before, after);
  expect(rebuildOld(ops, join)).toBe(before);
  expect(rebuildNew(ops, join)).toBe(after);
  return ops;
}

/** Line numbers must be dense, monotonic and 1-based on each side. */
function expectIndicesConsistent(ops: readonly DiffOp[]): void {
  let oldCursor = 0;
  let newCursor = 0;
  for (const op of ops) {
    if (op.type === "insert") {
      expect(op.oldIndex).toBeUndefined();
    } else {
      oldCursor++;
      expect(op.oldIndex).toBe(oldCursor);
    }
    if (op.type === "delete") {
      expect(op.newIndex).toBeUndefined();
    } else {
      newCursor++;
      expect(op.newIndex).toBe(newCursor);
    }
  }
}

const RESUME_BEFORE = `\\section{Experience}
\\resumeSubheading{Northwind Systems}{Seattle, WA}
\\item Built the ingestion pipeline on Kafka
\\item Reduced p99 latency by 30\\%
\\item Mentored two interns
\\section{Education}
B.S. Computer Science, 2021`;

const RESUME_AFTER = `\\section{Experience}
\\resumeSubheading{Northwind Systems}{Seattle, WA}
\\item Built the ingestion pipeline on Kafka and Flink
\\item Reduced p99 latency by 62\\%
\\item Mentored two interns
\\item Owned the on-call rotation for eight services
\\section{Education}
B.S. Computer Science, 2021`;

describe("diffLines", () => {
  it("reports every line as equal when the documents are identical", () => {
    const { ops, stats } = diffLines(RESUME_BEFORE, RESUME_BEFORE);
    expect(ops.every((op) => op.type === "equal")).toBe(true);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
    expect(stats.unchanged).toBe(7);
    expect(stats.similarity).toBe(1);
  });

  it("treats a pure insertion as inserts only", () => {
    const { ops, stats } = diffLines("a\nb", "a\nnew\nb");
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(0);
    expect(stats.unchanged).toBe(2);
    expect(ops.filter((op) => op.type === "insert").map((op) => op.value)).toEqual(["new"]);
  });

  it("treats a pure deletion as deletes only", () => {
    const { stats } = diffLines("a\ngone\nb", "a\nb");
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(1);
    expect(stats.unchanged).toBe(2);
  });

  it("handles an empty original", () => {
    const ops = expectRoundTrip("", "first\nsecond");
    expect(ops.some((op) => op.type === "insert")).toBe(true);
  });

  it("handles an emptied document", () => {
    const ops = expectRoundTrip("first\nsecond", "");
    expect(ops.some((op) => op.type === "delete")).toBe(true);
  });

  it("handles both sides empty", () => {
    const { ops, stats } = diffLines("", "");
    expect(ops).toHaveLength(1);
    expect(ops[0]!.type).toBe("equal");
    expect(stats.similarity).toBe(1);
  });

  describe("reconstruction invariant", () => {
    const cases: Array<[string, string, string]> = [
      ["realistic resume edit", RESUME_BEFORE, RESUME_AFTER],
      ["reordered bullets", "one\ntwo\nthree", "three\none\ntwo"],
      ["whole document replaced", "alpha\nbeta\ngamma", "delta\nepsilon"],
      ["trailing blank lines added", "alpha\nbeta", "alpha\nbeta\n\n"],
      ["leading line removed", "header\nalpha\nbeta", "alpha\nbeta"],
      ["duplicate lines", "x\nx\nx\ny", "x\ny\nx\nx"],
      ["single character change", "abc", "abd"],
      ["only whitespace differs", "  indented", "indented"],
    ];

    for (const [name, before, after] of cases) {
      it(`rebuilds both documents: ${name}`, () => {
        const ops = expectRoundTrip(before, after);
        expectIndicesConsistent(ops);
      });
    }
  });

  it("numbers lines 1-based on both sides", () => {
    const { ops } = diffLines("a\nb\nc", "a\nB\nc");
    expect(ops[0]).toMatchObject({ type: "equal", value: "a", oldIndex: 1, newIndex: 1 });
    const del = ops.find((op) => op.type === "delete")!;
    const ins = ops.find((op) => op.type === "insert")!;
    expect(del).toMatchObject({ value: "b", oldIndex: 2 });
    expect(del.newIndex).toBeUndefined();
    expect(ins).toMatchObject({ value: "B", newIndex: 2 });
    expect(ins.oldIndex).toBeUndefined();
    expect(ops[ops.length - 1]).toMatchObject({ value: "c", oldIndex: 3, newIndex: 3 });
  });

  it("produces a minimal script: one changed line in ten is one insert and one delete", () => {
    const before = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n");
    const after = before.split("\n").map((l, i) => (i === 4 ? "line five rewritten" : l)).join("\n");
    const { ops, stats } = diffLines(before, after);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1);
    expect(stats.unchanged).toBe(9);
    expect(ops).toHaveLength(11);
    expectIndicesConsistent(ops);
  });

  it("diffs two 2000-line documents differing in three lines in well under a second", () => {
    const beforeLines = Array.from(
      { length: 2000 },
      (_, i) => `\\item Delivered workstream ${i} across the platform organisation`,
    );
    const afterLines = [...beforeLines];
    afterLines[10] = "\\item Delivered workstream 10 with a new caching layer";
    afterLines[1000] = "\\item Delivered workstream 1000 ahead of schedule";
    afterLines[1990] = "\\item Delivered workstream 1990 under a reduced budget";

    const before = beforeLines.join("\n");
    const after = afterLines.join("\n");

    const started = performance.now();
    const { ops, stats } = diffLines(before, after);
    const elapsedMs = performance.now() - started;

    expect(elapsedMs).toBeLessThan(1000);
    expect(stats.added).toBe(3);
    expect(stats.removed).toBe(3);
    expect(rebuildOld(ops, "\n")).toBe(before);
    expect(rebuildNew(ops, "\n")).toBe(after);
  });
});

describe("diffWords", () => {
  it("changes only the differing words in prose", () => {
    const before = "The quick brown fox jumps over the lazy dog";
    const after = "The quick red fox leaps over the lazy dog";
    const { ops, stats } = diffWords(before, after);
    expect(rebuildOld(ops, "")).toBe(before);
    expect(rebuildNew(ops, "")).toBe(after);
    expect(stats.added).toBe(2);
    expect(stats.removed).toBe(2);
    expect(ops.filter((op) => op.type === "insert").map((op) => op.value)).toEqual([
      "red",
      "leaps",
    ]);
  });

  it("rebuilds a cover-letter paragraph exactly", () => {
    const before =
      "Dear hiring manager,\n\nI am applying for the backend role. I have shipped\npayment systems at scale.";
    const after =
      "Dear hiring manager,\n\nI am applying for the platform role. I have shipped\nresilient payment systems at scale.";
    const { ops } = diffWords(before, after);
    expect(rebuildOld(ops, "")).toBe(before);
    expect(rebuildNew(ops, "")).toBe(after);
  });

  it("does not count whitespace-only edits as changes in the stats", () => {
    const { stats } = diffWords("alpha beta", "alpha   beta");
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
  });

  it("returns no ops for empty input on both sides", () => {
    const { ops, stats } = diffWords("", "");
    expect(ops).toEqual([]);
    expect(stats.similarity).toBe(1);
  });
});

describe("diff", () => {
  it("defaults to line granularity", () => {
    expect(diff("a\nb", "a\nc")).toEqual(diffLines("a\nb", "a\nc"));
  });

  it("dispatches to word granularity when asked", () => {
    expect(diff("a b", "a c", "word")).toEqual(diffWords("a b", "a c"));
  });
});

describe("toHunks", () => {
  it("returns no hunks when nothing changed", () => {
    const { ops } = diffLines(RESUME_BEFORE, RESUME_BEFORE);
    expect(toHunks(ops)).toEqual([]);
  });

  it("returns no hunks for two empty documents", () => {
    expect(toHunks(diffLines("", "").ops)).toEqual([]);
  });

  it("surrounds a single change with the requested amount of context", () => {
    const before = Array.from({ length: 11 }, (_, i) => `line ${i + 1}`).join("\n");
    const after = before.split("\n").map((l, i) => (i === 5 ? "line six edited" : l)).join("\n");
    const { ops } = diffLines(before, after);
    const hunks = toHunks(ops, 2);

    expect(hunks).toHaveLength(1);
    const hunk = hunks[0]!;
    // Two equal lines before the change, then delete + insert, then two after.
    expect(hunk.ops.map((op) => op.type)).toEqual([
      "equal",
      "equal",
      "delete",
      "insert",
      "equal",
      "equal",
    ]);
    expect(hunk.oldStart).toBe(4);
    expect(hunk.newStart).toBe(4);
  });

  it("splits distant changes into separate hunks", () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
    const after = before
      .split("\n")
      .map((l, i) => (i === 1 ? "line two edited" : i === 17 ? "line eighteen edited" : l))
      .join("\n");
    const hunks = toHunks(diffLines(before, after).ops, 3);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]!.ops.some((op) => op.value === "line two edited")).toBe(true);
    expect(hunks[1]!.ops.some((op) => op.value === "line eighteen edited")).toBe(true);
  });

  it("merges changes that are closer together than twice the context", () => {
    const before = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n");
    const after = before
      .split("\n")
      .map((l, i) => (i === 4 ? "line five edited" : i === 6 ? "line seven edited" : l))
      .join("\n");
    expect(toHunks(diffLines(before, after).ops, 3)).toHaveLength(1);
  });

  it("reports the old-side start of a hunk that begins with an insert", () => {
    const before = "l1\nl2\nl3\nl4\nl5";
    const after = "l1\nl2\nX\nl3\nl4\nl5";
    const hunks = toHunks(diffLines(before, after).ops, 0);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.newStart).toBe(3);
    expect(hunks[0]!.oldStart).toBe(3);
  });
});

describe("similarity", () => {
  it("is 1 for identical strings, including empty ones", () => {
    expect(similarity("same", "same")).toBe(1);
    expect(similarity("", "")).toBe(1);
  });

  it("is 0 when one side is empty", () => {
    expect(similarity("", "something")).toBe(0);
    expect(similarity("something", "")).toBe(0);
  });

  it("is 0 for two completely different documents", () => {
    expect(similarity("alpha\nbeta", "gamma\ndelta")).toBe(0);
  });

  it("falls between 0 and 1 for a partial rewrite", () => {
    const value = similarity(RESUME_BEFORE, RESUME_AFTER);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });

  it("ranks a small edit as more similar than a large one", () => {
    const base = "a\nb\nc\nd\ne";
    expect(similarity(base, "a\nb\nX\nd\ne")).toBeGreaterThan(
      similarity(base, "a\nX\nY\nZ\ne"),
    );
  });
});
