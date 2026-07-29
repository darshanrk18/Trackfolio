/**
 * Job-description keyword extraction and resume matching.
 *
 * Two properties matter more than raw recall here:
 *
 * 1. **Alias awareness** — a resume saying "k8s" must satisfy a posting asking
 *    for "Kubernetes". Reporting that as a gap is worse than useless, because
 *    it pushes people to pad their resume with duplicates.
 * 2. **Requirement tiering** — "must have" and "nice to have" are weighted
 *    differently, so the match score reflects real hiring-bar risk.
 */

import { stripLatex } from "./latex";
import {
  canonicalize,
  resolveSkill,
  SKILLS,
  SKILL_SURFACES,
  STOPWORDS,
  type Skill,
  type SkillCategory,
} from "./taxonomy";

export type RequirementTier = "must" | "preferred" | "other";

export interface ExtractedTerm {
  /** Canonical display name. */
  term: string;
  /** Surface forms actually seen in the posting. */
  matched: string[];
  category: SkillCategory | "keyword";
  tier: RequirementTier;
  /** Number of occurrences in the posting. */
  count: number;
  /** Composite importance score used for weighting the match. */
  weight: number;
}

export interface MatchedTerm extends ExtractedTerm {
  present: boolean;
  /** Where in the resume the term was found, if present. */
  evidence?: string;
}

export interface MatchResult {
  score: number;
  terms: MatchedTerm[];
  must: MatchedTerm[];
  preferred: MatchedTerm[];
  other: MatchedTerm[];
  missing: MatchedTerm[];
  present: MatchedTerm[];
  /** Coverage of "must have" requirements specifically. */
  mustCoverage: number;
}

const TIER_WEIGHT: Record<RequirementTier, number> = {
  must: 3,
  preferred: 1.5,
  other: 0.75,
};

/** Headings that mark the start of a hard-requirements block. */
const MUST_HEADINGS =
  /\b(?:basic|minimum|required)\s+qualifications?\b|\brequirements?\b|\bwhat\s+you'?ll\s+need\b|\bwho\s+you\s+are\b|\byou\s+(?:must|should)\s+have\b|\bmust[-\s]haves?\b/i;

/** Headings that mark the start of a nice-to-have block. */
const PREFERRED_HEADINGS =
  /\b(?:preferred|desired|additional|bonus)\s+(?:qualifications?|skills?|experience)\b|\bnice[-\s]to[-\s]haves?\b|\bplus(?:es)?\b|\bbonus\s+points?\b|\bwe'?d\s+love\b/i;

/** Headings after which content is duties, not requirements. */
const RESPONSIBILITY_HEADINGS =
  /\b(?:what\s+you'?ll\s+do|responsibilities|the\s+role|about\s+the\s+(?:role|job|team)|day[-\s]to[-\s]day|in\s+this\s+role)\b/i;

/** Inline cues used when a line sits outside any recognised section. */
const MUST_CUES =
  /\b(?:required|must\s+have|minimum(?:\s+of)?|at\s+least|proven|demonstrated|strong\s+(?:experience|background)|solid\s+(?:experience|understanding))\b/i;
const PREFERRED_CUES =
  /\b(?:preferred|nice\s+to\s+have|bonus|a\s+plus|ideally|desirable|familiarity\s+with|exposure\s+to|willing(?:ness)?\s+to\s+learn)\b/i;

/**
 * Splits a posting into lines tagged with the requirement tier implied by the
 * nearest preceding heading, falling back to inline cues.
 */
function tierByLine(jd: string): Array<{ line: string; tier: RequirementTier }> {
  const lines = jd.split(/\r?\n/);
  const result: Array<{ line: string; tier: RequirementTier }> = [];
  let sectionTier: RequirementTier = "other";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Only a line that is *structurally* a heading switches the active section
    // and is then discarded. "Familiarity with Rust is a plus" matches the
    // preferred pattern but is a requirement, not a heading — treating it as
    // one would drop Rust from the analysis entirely.
    const words = line.split(/\s+/).length;
    const isHeading =
      line.length <= 60 &&
      (/[:：]\s*$/.test(line) || words <= 5) &&
      !/^[-*•]/.test(line);

    if (isHeading) {
      if (PREFERRED_HEADINGS.test(line)) {
        sectionTier = "preferred";
        continue;
      }
      if (MUST_HEADINGS.test(line)) {
        sectionTier = "must";
        continue;
      }
      if (RESPONSIBILITY_HEADINGS.test(line)) {
        sectionTier = "other";
        continue;
      }
    }

    let tier = sectionTier;
    if (PREFERRED_CUES.test(line) || PREFERRED_HEADINGS.test(line)) tier = "preferred";
    else if (MUST_CUES.test(line) || MUST_HEADINGS.test(line)) tier = "must";

    result.push({ line, tier });
  }

  return result;
}

/** Escapes a term for use inside a RegExp. */
function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a boundary-aware matcher for a term.
 *
 * `\b` is unusable for terms like "C++", ".NET" and "C#" because `+`, `.` and
 * `#` are not word characters, so the boundary lands in the wrong place. This
 * uses explicit look-around on the characters that can legitimately abut a
 * technical token instead.
 */
export function termPattern(term: string): RegExp {
  const escaped = escapeRe(term.toLowerCase());
  const startsAlnum = /^[a-z0-9]/i.test(term);
  const endsAlnum = /[a-z0-9]$/i.test(term);
  const prefix = startsAlnum ? "(?<![a-z0-9+#])" : "(?<![a-z0-9])";
  const suffix = endsAlnum ? "(?![a-z0-9+#.]*[a-z0-9+#])" : "(?![a-z0-9])";
  return new RegExp(`${prefix}${escaped}${suffix}`, "gi");
}

/** Counts non-overlapping occurrences of `term` in `haystack`. */
export function countOccurrences(haystack: string, term: string): number {
  const re = termPattern(term);
  let count = 0;
  while (re.exec(haystack) !== null) {
    count++;
    if (count > 500) break; // Defensive bound against pathological input.
  }
  return count;
}

/** True when any surface form of the skill appears in the text. */
export function containsSkill(haystack: string, skill: Skill): boolean {
  if (termPattern(skill.canonical).test(haystack)) return true;
  return skill.aliases.some((alias) => termPattern(alias).test(haystack));
}

export interface ExtractOptions {
  /** Maximum number of terms to return. */
  limit?: number;
  /** Include high-frequency non-taxonomy words as generic keywords. */
  includeGenericKeywords?: boolean;
}

/**
 * Extracts the technical requirements a posting is actually asking for.
 */
export function extractRequirements(
  jobDescription: string,
  options: ExtractOptions = {},
): ExtractedTerm[] {
  const { limit = 60, includeGenericKeywords = true } = options;
  const jd = jobDescription ?? "";
  if (!jd.trim()) return [];

  const tiered = tierByLine(jd);
  const found = new Map<string, ExtractedTerm>();

  const tierRank: Record<RequirementTier, number> = { must: 3, preferred: 2, other: 1 };

  for (const { line, tier } of tiered) {
    const lower = line.toLowerCase();

    for (const skill of SKILLS) {
      const surfaces = [skill.canonical, ...skill.aliases];
      let lineCount = 0;
      const matchedSurfaces: string[] = [];

      for (const surface of surfaces) {
        if (surface.toLowerCase() === skill.canonical.toLowerCase() && surface !== skill.canonical) {
          continue;
        }
        const n = countOccurrences(lower, surface);
        if (n > 0) {
          lineCount += n;
          matchedSurfaces.push(surface);
        }
      }
      if (lineCount === 0) continue;

      const existing = found.get(skill.canonical);
      if (existing) {
        existing.count += lineCount;
        // A term mentioned anywhere as a hard requirement stays a hard requirement.
        if (tierRank[tier] > tierRank[existing.tier]) existing.tier = tier;
        for (const m of matchedSurfaces) {
          if (!existing.matched.includes(m)) existing.matched.push(m);
        }
      } else {
        found.set(skill.canonical, {
          term: skill.canonical,
          matched: matchedSurfaces,
          category: skill.category,
          tier,
          count: lineCount,
          weight: 0, // Computed below.
        });
      }
    }
  }

  // Generic high-frequency keywords catch domain vocabulary the taxonomy misses
  // (e.g. "telemetry", "fintech", "compiler").
  if (includeGenericKeywords) {
    const freq = new Map<string, number>();
    const lower = jd.toLowerCase();
    for (const token of lower.match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []) {
      const word = token.replace(/[.\-]+$/, "");
      if (word.length < 4 || STOPWORDS.has(word)) continue;
      if (resolveSkill(word)) continue;
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
    const generic = Array.from(freq.entries())
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    for (const [word, count] of generic) {
      if (found.has(word)) continue;
      found.set(word, {
        term: word,
        matched: [word],
        category: "keyword",
        tier: "other",
        count,
        weight: 0,
      });
    }
  }

  const terms = Array.from(found.values());
  for (const term of terms) {
    const skill = resolveSkill(term.term);
    const base = skill?.weight ?? 0.6;
    // Repetition matters but with diminishing returns, so a posting that says
    // "Python" nine times does not drown out everything else.
    const repetition = 1 + Math.log2(term.count);
    term.weight = Number((base * TIER_WEIGHT[term.tier] * repetition).toFixed(3));
  }

  return terms
    .sort((a, b) => b.weight - a.weight || b.count - a.count)
    .slice(0, limit);
}

/** Finds a short snippet of the resume containing the term, for evidence. */
function findEvidence(plainResume: string, term: string, aliases: string[]): string | undefined {
  for (const surface of [term, ...aliases]) {
    const re = termPattern(surface);
    const match = re.exec(plainResume);
    if (match) {
      const start = Math.max(0, match.index - 60);
      const end = Math.min(plainResume.length, match.index + surface.length + 60);
      const snippet = plainResume.slice(start, end).replace(/\s+/g, " ").trim();
      return (start > 0 ? "…" : "") + snippet + (end < plainResume.length ? "…" : "");
    }
  }
  return undefined;
}

/**
 * Scores a resume against extracted requirements.
 *
 * The score is weighted by tier, so missing one hard requirement costs more
 * than missing several nice-to-haves.
 */
export function matchAgainstResume(
  terms: ExtractedTerm[],
  resumeSource: string,
): MatchResult {
  // Search both the rendered text and the raw source: a skill may legitimately
  // appear inside a macro argument or a URL.
  const plain = stripLatex(resumeSource ?? "");
  const haystack = `${plain}\n${resumeSource ?? ""}`.toLowerCase();

  const matched: MatchedTerm[] = terms.map((term) => {
    const skill = resolveSkill(term.term);
    const aliases = skill ? [...skill.aliases] : [];
    const present =
      termPattern(term.term).test(haystack) ||
      aliases.some((alias) => termPattern(alias).test(haystack));

    return {
      ...term,
      present,
      evidence: present ? findEvidence(plain, term.term, aliases) : undefined,
    };
  });

  const totalWeight = matched.reduce((sum, t) => sum + t.weight, 0);
  const hitWeight = matched.reduce((sum, t) => (t.present ? sum + t.weight : sum), 0);
  const score = totalWeight > 0 ? Math.round((hitWeight / totalWeight) * 100) : 0;

  const must = matched.filter((t) => t.tier === "must");
  const mustHit = must.filter((t) => t.present).length;

  return {
    score,
    terms: matched,
    must,
    preferred: matched.filter((t) => t.tier === "preferred"),
    other: matched.filter((t) => t.tier === "other"),
    missing: matched.filter((t) => !t.present),
    present: matched.filter((t) => t.present),
    mustCoverage: must.length > 0 ? Math.round((mustHit / must.length) * 100) : 100,
  };
}

/** Convenience wrapper: extract then match in one call. */
export function analyzeJobMatch(
  jobDescription: string,
  resumeSource: string,
  options?: ExtractOptions,
): MatchResult {
  return matchAgainstResume(extractRequirements(jobDescription, options), resumeSource);
}

/**
 * Terms from the watchlist that are missing from the given document.
 * Alias-aware, so "k8s" satisfies a "Kubernetes" guardrail.
 */
export function findMissingTerms(source: string, watchlist: readonly string[]): string[] {
  if (watchlist.length === 0) return [];
  const plain = stripLatex(source ?? "");
  const haystack = `${plain}\n${source ?? ""}`.toLowerCase();

  return watchlist.filter((raw) => {
    const term = raw.trim();
    if (!term) return false;
    const skill = resolveSkill(term);
    if (skill) return !containsSkill(haystack, skill);
    return !termPattern(term).test(haystack);
  });
}

/** Skills present in the resume but absent from the posting — possible noise. */
export function findUnusedStrengths(
  resumeSource: string,
  jobDescription: string,
  limit = 12,
): string[] {
  const plain = `${stripLatex(resumeSource ?? "")}\n${resumeSource ?? ""}`.toLowerCase();
  const jd = (jobDescription ?? "").toLowerCase();
  const out: string[] = [];
  for (const skill of SKILLS) {
    if (out.length >= limit) break;
    if (containsSkill(plain, skill) && !containsSkill(jd, skill)) {
      out.push(skill.canonical);
    }
  }
  return out;
}

export { canonicalize, SKILL_SURFACES };
