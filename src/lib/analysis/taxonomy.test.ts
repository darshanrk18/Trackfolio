import { describe, expect, it } from "vitest";
import {
  canonicalize,
  resolveSkill,
  SKILLS,
  SKILL_INDEX,
  SKILL_SURFACES,
  STOPWORDS,
} from "./taxonomy";

describe("resolveSkill", () => {
  it("resolves a canonical name", () => {
    expect(resolveSkill("Kubernetes")?.canonical).toBe("Kubernetes");
  });

  it("resolves aliases to their canonical skill", () => {
    expect(resolveSkill("k8s")?.canonical).toBe("Kubernetes");
    expect(resolveSkill("kube")?.canonical).toBe("Kubernetes");
    expect(resolveSkill("postgres")?.canonical).toBe("PostgreSQL");
    expect(resolveSkill("golang")?.canonical).toBe("Go");
    expect(resolveSkill("k8s")).toBe(resolveSkill("Kubernetes"));
  });

  it("is case-insensitive and trims surrounding whitespace", () => {
    expect(resolveSkill("  KUBERNETES  ")?.canonical).toBe("Kubernetes");
    expect(resolveSkill("\tGoLang\n")?.canonical).toBe("Go");
  });

  it("returns undefined for unknown terms", () => {
    expect(resolveSkill("Trackfolio")).toBeUndefined();
    expect(resolveSkill("")).toBeUndefined();
    expect(resolveSkill("   ")).toBeUndefined();
  });

  it("resolves punctuation-heavy names", () => {
    expect(resolveSkill("C++")?.canonical).toBe("C++");
    expect(resolveSkill("c#")?.canonical).toBe("C#");
    expect(resolveSkill(".net")?.canonical).toBe("C#");
    expect(resolveSkill("ci/cd")?.canonical).toBe("CI/CD");
    expect(resolveSkill("node.js")?.canonical).toBe("Node.js");
  });
});

describe("canonicalize", () => {
  it("maps an alias to its display form", () => {
    expect(canonicalize("k8s")).toBe("Kubernetes");
    expect(canonicalize("PSQL")).toBe("PostgreSQL");
    expect(canonicalize("js")).toBe("JavaScript");
  });

  it("returns the trimmed input for unknown terms", () => {
    expect(canonicalize("  quantum widgetry  ")).toBe("quantum widgetry");
  });

  it("is idempotent", () => {
    for (const term of ["k8s", "golang", "Rust", "unknown thing"]) {
      expect(canonicalize(canonicalize(term))).toBe(canonicalize(term));
    }
  });
});

describe("SKILL_INDEX", () => {
  it("maps every canonical name back to its own skill", () => {
    for (const skill of SKILLS) {
      expect(SKILL_INDEX.get(skill.canonical.toLowerCase())).toBe(skill);
    }
  });

  it("resolves every alias to some skill", () => {
    for (const skill of SKILLS) {
      for (const alias of skill.aliases) {
        expect(SKILL_INDEX.get(alias.toLowerCase())).toBeDefined();
      }
    }
  });

  it("never lets an alias clobber another skill's canonical name", () => {
    const canonicals = new Set(SKILLS.map((s) => s.canonical.toLowerCase()));
    for (const key of canonicals) {
      expect(SKILL_INDEX.get(key)!.canonical.toLowerCase()).toBe(key);
    }
  });

  it("has no duplicate canonical names", () => {
    const seen = new Set<string>();
    for (const skill of SKILLS) {
      const key = skill.canonical.toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("gives every skill a positive weight", () => {
    for (const skill of SKILLS) {
      expect(skill.weight).toBeGreaterThan(0);
      expect(Number.isFinite(skill.weight)).toBe(true);
    }
  });

  it("does not list a skill's own canonical name among its aliases", () => {
    const offenders = SKILLS.filter((s) =>
      s.aliases.some((a) => a.toLowerCase() === s.canonical.toLowerCase()),
    ).map((s) => s.canonical);
    expect(offenders).toEqual([]);
  });
});

describe("SKILL_SURFACES", () => {
  it("contains every indexed surface form", () => {
    expect(SKILL_SURFACES).toHaveLength(SKILL_INDEX.size);
    expect(new Set(SKILL_SURFACES)).toEqual(new Set(SKILL_INDEX.keys()));
  });

  it("is sorted longest first so multi-word phrases match before their parts", () => {
    for (let i = 1; i < SKILL_SURFACES.length; i++) {
      expect(SKILL_SURFACES[i - 1]!.length).toBeGreaterThanOrEqual(
        SKILL_SURFACES[i]!.length,
      );
    }
  });

  it("is entirely lowercase", () => {
    for (const surface of SKILL_SURFACES) {
      expect(surface).toBe(surface.toLowerCase());
    }
  });
});

describe("STOPWORDS", () => {
  it("filters generic posting vocabulary", () => {
    for (const word of ["the", "experience", "responsibilities", "candidate"]) {
      expect(STOPWORDS.has(word)).toBe(true);
    }
  });

  it("is entirely lowercase, since lookups are done on lowercased tokens", () => {
    for (const word of STOPWORDS) {
      expect(word).toBe(word.toLowerCase());
    }
  });
});
