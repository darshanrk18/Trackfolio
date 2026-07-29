import { describe, expect, it } from "vitest";
import {
  analyzeJobMatch,
  containsSkill,
  countOccurrences,
  extractRequirements,
  findMissingTerms,
  findUnusedStrengths,
  matchAgainstResume,
  termPattern,
  type ExtractedTerm,
} from "./keywords";
import { resolveSkill } from "./taxonomy";

/** `termPattern` is stateful (`g` flag), so build a fresh one per assertion. */
function matches(term: string, haystack: string): boolean {
  return termPattern(term).test(haystack);
}

function findTerm(terms: ExtractedTerm[], name: string): ExtractedTerm | undefined {
  return terms.find((t) => t.term === name);
}

describe("termPattern", () => {
  it("matches punctuation-heavy technology names", () => {
    expect(matches("C++", "Strong C++ and systems programming")).toBe(true);
    expect(matches("C#", "Built services in C# on Windows")).toBe(true);
    expect(matches(".NET", "Migrated the app to .NET 8")).toBe(true);
    expect(matches("CI/CD", "Owned the CI/CD pipeline")).toBe(true);
    expect(matches("Node.js", "Node.js and Express")).toBe(true);
  });

  it("matches at the very start and very end of the haystack", () => {
    expect(matches("C++", "C++")).toBe(true);
    expect(matches("Go", "Go")).toBe(true);
    expect(matches("Rust", "We write Rust")).toBe(true);
  });

  it("matches a term followed by sentence punctuation", () => {
    expect(matches("Go", "We ship in Go.")).toBe(true);
    expect(matches("Go", "Go, Rust and Python")).toBe(true);
    expect(matches("Kubernetes", "(Kubernetes)")).toBe(true);
    expect(matches("Go", "Go/Rust")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matches("Kubernetes", "KUBERNETES")).toBe(true);
    expect(matches("kubernetes", "Kubernetes")).toBe(true);
    expect(matches("c++", "C++")).toBe(true);
  });

  it("does not match a term embedded in a larger token", () => {
    expect(matches("Go", "Google")).toBe(false);
    expect(matches("Go", "Django")).toBe(false);
    expect(matches("Go", "algorithm")).toBe(false);
    expect(matches("Go", "going")).toBe(false);
    expect(matches("Go", "ago")).toBe(false);
    expect(matches("Java", "JavaScript")).toBe(false);
    expect(matches("React", "Preact")).toBe(false);
    expect(matches("Rust", "Rusty")).toBe(false);
    expect(matches("SQL", "PostgreSQL")).toBe(false);
    expect(matches("Node.js", "Node.jsx")).toBe(false);
  });

  it("does not let a single-letter language leak into longer tokens", () => {
    expect(matches("C", "C++")).toBe(false);
    expect(matches("C", "C#")).toBe(false);
    expect(matches("C", "CSS")).toBe(false);
    expect(matches("C", "Scala")).toBe(false);
    expect(matches("C", "cloud")).toBe(false);
    expect(matches("R", "React")).toBe(false);
    expect(matches("R", "Rust")).toBe(false);
    // ...but a genuinely standalone mention still counts.
    expect(matches("C", "Languages: C, Python, Go")).toBe(true);
    expect(matches("R", "Statistics in R and MATLAB")).toBe(true);
  });

  it("does not match across a preceding alphanumeric character", () => {
    expect(matches("NET", "ASP.NET")).toBe(true); // "." is not alphanumeric
    expect(matches(".NET", "ASP.NET")).toBe(false);
    expect(matches("Kafka", "MyKafka")).toBe(false);
  });

  it("treats a hyphen as a token boundary", () => {
    expect(matches("Go", "Go-based services")).toBe(true);
    expect(matches("Kubernetes", "Kubernetes-native tooling")).toBe(true);
    // The flip side of the same rule: hyphenated English words can collide
    // with two-letter language names.
    expect(matches("Go", "a real go-getter")).toBe(true);
  });
});

describe("countOccurrences", () => {
  it("counts every standalone occurrence", () => {
    expect(countOccurrences("python, python and Python", "Python")).toBe(3);
  });

  it("does not count substring hits", () => {
    expect(countOccurrences("Google Django algorithms", "Go")).toBe(0);
    expect(countOccurrences("PostgreSQL and SQL", "SQL")).toBe(1);
  });

  it("returns 0 when the term is absent", () => {
    expect(countOccurrences("We use Rust", "Kubernetes")).toBe(0);
  });

  it("terminates on a degenerate empty term", () => {
    // The zero-width pattern cannot advance `lastIndex`; the internal bound
    // must stop the loop rather than hanging the caller.
    expect(Number.isFinite(countOccurrences("a  b  c", ""))).toBe(true);
  });
});

describe("containsSkill", () => {
  const kubernetes = resolveSkill("Kubernetes")!;
  const go = resolveSkill("Go")!;

  it("matches the canonical form", () => {
    expect(containsSkill("Ran Kubernetes in production", kubernetes)).toBe(true);
  });

  it("matches any alias", () => {
    expect(containsSkill("Ran k8s in production", kubernetes)).toBe(true);
    expect(containsSkill("Ran kube clusters", kubernetes)).toBe(true);
    expect(containsSkill("Wrote golang services", go)).toBe(true);
  });

  it("rejects substring lookalikes", () => {
    expect(containsSkill("Worked at Google", go)).toBe(false);
    expect(containsSkill("Built a Django app", go)).toBe(false);
  });
});

describe("extractRequirements", () => {
  const TIERED_JD = `About the role
We are building a payments platform for small businesses.

Required Qualifications:
- 5+ years building backend services in Python
- Production experience with Kubernetes and Docker
- Solid SQL and PostgreSQL fundamentals

Preferred Qualifications:
- Experience with Rust
- Terraform for infrastructure automation

Nice to have:
- GraphQL schema design`;

  it("returns an empty list for empty or whitespace-only input", () => {
    expect(extractRequirements("")).toEqual([]);
    expect(extractRequirements("   \n\t  \n ")).toEqual([]);
  });

  it("finds the technologies a posting asks for", () => {
    const terms = extractRequirements(TIERED_JD);
    const names = terms.map((t) => t.term);
    expect(names).toEqual(
      expect.arrayContaining([
        "Python",
        "Kubernetes",
        "Docker",
        "PostgreSQL",
        "Rust",
        "Terraform",
        "GraphQL",
      ]),
    );
  });

  it("assigns must tier to terms under a hard-requirements heading", () => {
    const terms = extractRequirements(TIERED_JD);
    expect(findTerm(terms, "Python")?.tier).toBe("must");
    expect(findTerm(terms, "Kubernetes")?.tier).toBe("must");
    expect(findTerm(terms, "Docker")?.tier).toBe("must");
  });

  it("assigns preferred tier to terms under a nice-to-have heading", () => {
    const terms = extractRequirements(TIERED_JD);
    expect(findTerm(terms, "Rust")?.tier).toBe("preferred");
    expect(findTerm(terms, "Terraform")?.tier).toBe("preferred");
    expect(findTerm(terms, "GraphQL")?.tier).toBe("preferred");
  });

  it("weights must-tier terms above preferred ones", () => {
    const terms = extractRequirements(TIERED_JD);
    expect(findTerm(terms, "Kubernetes")!.weight).toBeGreaterThan(
      findTerm(terms, "Terraform")!.weight,
    );
  });

  it("keeps the strongest tier when a term appears in several sections", () => {
    const jd = `Preferred Qualifications:
- Redis caching

Required Qualifications:
- Redis at production scale`;
    expect(findTerm(extractRequirements(jd), "Redis")?.tier).toBe("must");
  });

  it("treats content under a responsibilities heading as untiered", () => {
    const jd = `What you'll do
- Operate the Cassandra fleet`;
    expect(findTerm(extractRequirements(jd), "Cassandra")?.tier).toBe("other");
  });

  it("records the surface forms actually seen in the posting", () => {
    const terms = extractRequirements("Requirements\n- Deep k8s experience");
    expect(findTerm(terms, "Kubernetes")?.matched).toContain("k8s");
  });

  it("applies an inline must cue on a line that is not heading-like", () => {
    const jd =
      "Candidates must have at least three years of production Python and Django experience on a distributed team.";
    const terms = extractRequirements(jd);
    expect(findTerm(terms, "Python")?.tier).toBe("must");
    expect(findTerm(terms, "Django")?.tier).toBe("must");
  });

  it("applies an inline preferred cue on a line that is not heading-like", () => {
    const jd =
      "Familiarity with Rust or Elixir is welcome, and we are happy to teach either language to the right engineer.";
    const terms = extractRequirements(jd);
    expect(findTerm(terms, "Rust")?.tier).toBe("preferred");
    expect(findTerm(terms, "Elixir")?.tier).toBe("preferred");
  });

  it("collects repeated generic vocabulary the taxonomy does not know", () => {
    const jd = `We build for the fintech market.
Our fintech customers reconcile ledgers hourly.
Every fintech workflow must settle overnight.`;
    const names = extractRequirements(jd).map((t) => t.term);
    expect(names).toContain("fintech");
  });

  it("omits generic vocabulary when asked", () => {
    const jd = `We build compilers.
Our compilers team owns the backend.
Compilers are hard.
Requirements
- Rust`;
    const names = extractRequirements(jd, { includeGenericKeywords: false }).map((t) => t.term);
    expect(names).toContain("Rust");
    expect(names).not.toContain("compilers");
  });

  it("respects the limit option", () => {
    expect(extractRequirements(TIERED_JD, { limit: 3 })).toHaveLength(3);
  });

  it("returns terms sorted by descending weight", () => {
    const terms = extractRequirements(TIERED_JD);
    for (let i = 1; i < terms.length; i++) {
      expect(terms[i - 1]!.weight).toBeGreaterThanOrEqual(terms[i]!.weight);
    }
  });

  it("extracts a term from a short line carrying an inline must cue", () => {
    const terms = extractRequirements("We are hiring.\nMust have 3+ years of Python.\n");
    expect(findTerm(terms, "Python")?.tier).toBe("must");
  });

  it("extracts a term from a short line carrying an inline preferred cue", () => {
    const terms = extractRequirements("We are hiring.\nFamiliarity with Rust is a plus.\n");
    expect(findTerm(terms, "Rust")?.tier).toBe("preferred");
  });

  it("counts a single mention of a skill exactly once", () => {
    const terms = extractRequirements("Requirements\n- PostgreSQL tuning");
    expect(findTerm(terms, "PostgreSQL")?.count).toBe(1);
  });
});

describe("matchAgainstResume", () => {
  const TERMS: ExtractedTerm[] = [
    {
      term: "Kubernetes",
      matched: ["kubernetes"],
      category: "devops",
      tier: "must",
      count: 2,
      weight: 3.9,
    },
    {
      term: "PostgreSQL",
      matched: ["postgresql"],
      category: "database",
      tier: "must",
      count: 1,
      weight: 3.9,
    },
    {
      term: "Rust",
      matched: ["rust"],
      category: "language",
      tier: "preferred",
      count: 1,
      weight: 1.8,
    },
  ];

  it("scores 100 when every requirement is present", () => {
    const result = matchAgainstResume(
      TERMS,
      "Operated Kubernetes clusters, tuned PostgreSQL, and shipped Rust services.",
    );
    expect(result.score).toBe(100);
    expect(result.mustCoverage).toBe(100);
    expect(result.missing).toEqual([]);
    expect(result.present).toHaveLength(3);
  });

  it("scores 0 when nothing is present", () => {
    const result = matchAgainstResume(TERMS, "Baked sourdough for a neighbourhood bakery.");
    expect(result.score).toBe(0);
    expect(result.mustCoverage).toBe(0);
    expect(result.present).toEqual([]);
    expect(result.missing).toHaveLength(3);
  });

  it("computes mustCoverage over must-tier terms only", () => {
    const onlyPreferred = matchAgainstResume(TERMS, "Shipped Rust services for a trading desk.");
    expect(onlyPreferred.mustCoverage).toBe(0);
    expect(onlyPreferred.score).toBeGreaterThan(0);
    expect(onlyPreferred.score).toBeLessThan(100);

    const onlyMust = matchAgainstResume(TERMS, "Ran Kubernetes and PostgreSQL in production.");
    expect(onlyMust.mustCoverage).toBe(100);
    expect(onlyMust.score).toBeLessThan(100);

    const half = matchAgainstResume(TERMS, "Ran Kubernetes and shipped Rust services.");
    expect(half.mustCoverage).toBe(50);
  });

  it("reports 100% must coverage when the posting has no must-tier terms", () => {
    const preferredOnly = TERMS.filter((t) => t.tier === "preferred");
    expect(matchAgainstResume(preferredOnly, "nothing relevant here").mustCoverage).toBe(100);
  });

  it("scores 0 when there are no terms at all", () => {
    const result = matchAgainstResume([], "anything");
    expect(result.score).toBe(0);
    expect(result.mustCoverage).toBe(100);
  });

  it("accepts an alias in the resume for a canonical requirement", () => {
    const result = matchAgainstResume(
      TERMS,
      "Ran k8s clusters, tuned a postgres replica, and shipped Rust services.",
    );
    expect(result.missing).toEqual([]);
    expect(result.score).toBe(100);
  });

  it("accepts golang for a Go requirement", () => {
    const go: ExtractedTerm[] = [
      { term: "Go", matched: ["go"], category: "language", tier: "must", count: 1, weight: 3.6 },
    ];
    expect(matchAgainstResume(go, "Wrote golang microservices").score).toBe(100);
    expect(matchAgainstResume(go, "Interned at Google on Django").score).toBe(0);
  });

  it("buckets terms by tier without dropping any", () => {
    const result = matchAgainstResume(TERMS, "Kubernetes only");
    expect(result.must).toHaveLength(2);
    expect(result.preferred).toHaveLength(1);
    expect(result.other).toHaveLength(0);
    expect(result.terms).toHaveLength(3);
  });

  it("attaches a readable evidence snippet for present terms", () => {
    const result = matchAgainstResume(
      TERMS,
      "\\item Migrated 42 services onto \\textbf{Kubernetes} with zero downtime",
    );
    const kubernetes = result.terms.find((t) => t.term === "Kubernetes")!;
    expect(kubernetes.present).toBe(true);
    expect(kubernetes.evidence).toContain("Kubernetes");
    expect(kubernetes.evidence).not.toContain("\\textbf");
  });

  it("finds terms that only appear inside LaTeX macro arguments", () => {
    const result = matchAgainstResume(TERMS, "\\skillLine{Rust}{Systems}");
    expect(result.terms.find((t) => t.term === "Rust")!.present).toBe(true);
  });

  it("handles an empty resume without throwing", () => {
    const result = matchAgainstResume(TERMS, "");
    expect(result.score).toBe(0);
    expect(result.missing).toHaveLength(3);
  });
});

describe("analyzeJobMatch", () => {
  it("extracts and matches in one pass", () => {
    const jd = `Required Qualifications:
- Deep Kubernetes and Terraform experience
- Strong Python fundamentals`;
    const result = analyzeJobMatch(jd, "Ran k8s clusters with Terraform. Wrote Python tooling.");
    expect(result.score).toBeGreaterThan(50);
    expect(result.terms.length).toBeGreaterThan(0);
    expect(result.missing.map((t) => t.term)).not.toContain("Kubernetes");
  });

  it("returns an empty, zero-scored result for an empty posting", () => {
    const result = analyzeJobMatch("", "Ran Kubernetes clusters");
    expect(result.terms).toEqual([]);
    expect(result.score).toBe(0);
    expect(result.mustCoverage).toBe(100);
  });
});

describe("findMissingTerms", () => {
  it("returns an empty list for an empty watchlist", () => {
    expect(findMissingTerms("anything at all", [])).toEqual([]);
  });

  it("reports terms that are absent", () => {
    expect(findMissingTerms("Wrote Rust services", ["Kubernetes", "Terraform"])).toEqual([
      "Kubernetes",
      "Terraform",
    ]);
  });

  it("is alias-aware in both directions", () => {
    expect(findMissingTerms("Ran k8s in production", ["Kubernetes"])).toEqual([]);
    expect(findMissingTerms("Ran Kubernetes in production", ["k8s"])).toEqual([]);
    expect(findMissingTerms("Tuned a postgres replica", ["PostgreSQL"])).toEqual([]);
    expect(findMissingTerms("Wrote golang services", ["Go"])).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(findMissingTerms("ran KUBERNETES here", ["kubernetes"])).toEqual([]);
    expect(findMissingTerms("built a trackfolio clone", ["Trackfolio"])).toEqual([]);
  });

  it("falls back to a boundary-aware match for terms outside the taxonomy", () => {
    expect(findMissingTerms("Owned the Trackfolio rollout", ["Trackfolio"])).toEqual([]);
    expect(findMissingTerms("Owned the rollout", ["Trackfolio"])).toEqual(["Trackfolio"]);
  });

  it("looks inside LaTeX source as well as the rendered text", () => {
    expect(findMissingTerms("\\textbf{Kubernetes} operator work", ["Kubernetes"])).toEqual([]);
  });

  it("ignores blank watchlist entries", () => {
    expect(findMissingTerms("anything", ["   ", ""])).toEqual([]);
  });
});

describe("findUnusedStrengths", () => {
  it("lists resume skills the posting never mentions", () => {
    const strengths = findUnusedStrengths(
      "Shipped Rust services and tuned Cassandra clusters.",
      "We need a Python engineer for our data team.",
    );
    expect(strengths).toContain("Rust");
    expect(strengths).toContain("Cassandra");
  });

  it("excludes skills the posting already asks for", () => {
    const strengths = findUnusedStrengths(
      "Shipped Rust services.",
      "We need Rust engineers.",
    );
    expect(strengths).not.toContain("Rust");
  });

  it("matches aliases on both sides", () => {
    expect(
      findUnusedStrengths("Ran k8s clusters", "We need Kubernetes operators"),
    ).not.toContain("Kubernetes");
  });

  it("respects the limit", () => {
    const resume = "Rust Cassandra Elixir Haskell Perl Kotlin Swift Scala";
    expect(findUnusedStrengths(resume, "nothing relevant", 3)).toHaveLength(3);
  });

  it("returns an empty list for an empty resume", () => {
    expect(findUnusedStrengths("", "Python and Rust")).toEqual([]);
  });
});
