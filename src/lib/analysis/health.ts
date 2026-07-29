/**
 * Deterministic resume health scoring.
 *
 * Every check returns *why* it fired and *what to do about it*. A score with no
 * remedy is just anxiety, so `fix` is required on every non-passing result.
 */

import { countWords, extractBullets, extractSections, isLatex, stripLatex } from "./latex";
import { findMissingTerms } from "./keywords";
import { SKILLS } from "./taxonomy";

export type CheckState = "pass" | "warn" | "fail" | "skip";

export type CheckId =
  | "length"
  | "quantified"
  | "action-verbs"
  | "filler"
  | "contact"
  | "watchlist"
  | "bullet-length"
  | "pronouns"
  | "sections"
  | "verb-variety"
  | "ats"
  | "dates"
  | "capitalization"
  | "passive-voice";

export interface HealthCheck {
  id: CheckId;
  label: string;
  state: CheckState;
  /** 0–1 contribution before weighting. */
  score: number;
  /** Relative importance of this check in the overall score. */
  weight: number;
  why: string;
  fix?: string;
  /** Specific offending fragments, for inline highlighting in the editor. */
  offenders?: string[];
}

export interface HealthReport {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  checks: HealthCheck[];
  wordCount: number;
  bulletCount: number;
  sectionCount: number;
  quantifiedPct: number;
  actionVerbPct: number;
  /** Estimated printed pages, assuming ~520 words per dense page. */
  estimatedPages: number;
}

/** Verbs that signal ownership and impact at the start of a bullet. */
const ACTION_VERBS = new Set([
  "accelerated","achieved","architected","authored","automated","benchmarked","built","centralized",
  "collaborated","consolidated","containerized","converted","created","cut","debugged","decreased",
  "delivered","deployed","designed","developed","devised","diagnosed","directed","documented","doubled",
  "drove","eliminated","enabled","engineered","enhanced","established","evaluated","expanded","expedited",
  "extended","facilitated","formulated","founded","generated","grew","guided","hardened","headed",
  "identified","implemented","improved","increased","influenced","initiated","innovated","instrumented",
  "integrated","introduced","launched","led","leveraged","maintained","managed","mentored","migrated",
  "minimized","modernized","monitored","negotiated","optimized","orchestrated","overhauled","owned",
  "parallelized","partnered","pioneered","planned","presented","prototyped","published","reduced",
  "refactored","rearchitected","redesigned","reengineered","released","resolved","restructured",
  "revamped","scaled","secured","shipped","simplified","solved","spearheaded","standardized",
  "streamlined","strengthened","supervised","supported","synthesized","tested","tracked","trained",
  "transformed","translated","tuned","unified","upgraded","validated","won","wrote",
  // British spellings.
  "optimised","modernised","standardised","containerised","centralised","minimised","synthesised",
  "analysed","organised","prioritised","utilised",
  "analyzed","organized","prioritized","researched","configured","coordinated","administered",
]);

/** Verbs that describe presence rather than contribution. */
const WEAK_OPENERS = new Set([
  "worked","helped","assisted","participated","involved","responsible","tasked","exposed",
  "familiar","learned","studied","attended","joined","used","utilized","utilised","did","made",
  "handled","dealt","contributed","engaged","took","was","were","been","had","has","have",
]);

const FILLER_PHRASES = [
  "responsible for","helped with","worked on","assisted with","duties included","various tasks",
  "team player","hard worker","hard-working","familiar with","exposure to","participated in",
  "involved in","in charge of","tasked with","a variety of","among other things","as needed",
  "detail oriented","detail-oriented","self starter","self-starter","think outside the box",
  "results driven","results-driven","go-getter","synergy","dynamic individual","proven track record",
  "excellent communication skills","strong work ethic","fast learner","passionate about",
];

/**
 * Case is spelled out rather than using the `i` flag so that all-caps "US"
 * (the country) and "IT" do not register as pronouns.
 */
const FIRST_PERSON =
  /\b(?:I|I'm|I've|I'll|I'd|[Mm]e|[Mm]y|[Mm]ine|[Mm]yself|[Ww]e|[Ww]e're|[Ww]e've|[Oo]ur|[Oo]urs|[Oo]urselves|[Uu]s)\b/g;

/** Common miscapitalizations of technology names. */
const CAPITALIZATION_RULES: ReadonlyArray<{ wrong: RegExp; right: string }> = [
  { wrong: /\bjavascript\b/g, right: "JavaScript" },
  { wrong: /\bjava script\b/gi, right: "JavaScript" },
  { wrong: /\btypescript\b/g, right: "TypeScript" },
  { wrong: /\bnodejs\b/gi, right: "Node.js" },
  { wrong: /\bnode js\b/gi, right: "Node.js" },
  { wrong: /\bgithub\b/g, right: "GitHub" },
  { wrong: /\bgitlab\b/g, right: "GitLab" },
  { wrong: /\bpostgresql\b/g, right: "PostgreSQL" },
  { wrong: /\bpostgres\b/g, right: "PostgreSQL" },
  { wrong: /\bmysql\b/g, right: "MySQL" },
  { wrong: /\bmongodb\b/g, right: "MongoDB" },
  { wrong: /\bkubernetes\b/g, right: "Kubernetes" },
  { wrong: /\bdocker\b/g, right: "Docker" },
  { wrong: /\bpython\b/g, right: "Python" },
  { wrong: /\breactjs\b/gi, right: "React" },
  { wrong: /\bnextjs\b/gi, right: "Next.js" },
  { wrong: /\brestful\b/g, right: "RESTful" },
  { wrong: /\bgraphql\b/g, right: "GraphQL" },
  { wrong: /\bmacos\b/g, right: "macOS" },
  { wrong: /\bios\b/g, right: "iOS" },
  { wrong: /\bci\/cd\b/g, right: "CI/CD" },
];

const PASSIVE_VOICE =
  /\b(?:was|were|been|being|is|are)\s+(?:\w+ly\s+)?(?:\w+(?:ed|en))\b(?:\s+by\b)?/gi;

function firstWord(text: string): string {
  return (text.match(/[A-Za-z]+/)?.[0] ?? "").toLowerCase();
}

/** Detects a quantified outcome: a number, percentage, currency or multiplier. */
function isQuantified(bullet: string): boolean {
  return /\d/.test(bullet) && /\b\d[\d,.]*\s*(?:%|percent|x\b|k\b|m\b|b\b|ms\b|s\b|gb\b|tb\b|qps\b|rps\b)|[$€£]\s*\d|\b\d[\d,]{2,}\b|\b\d+\s*(?:\+|users|customers|requests|records|engineers|students|employees|hours|days|weeks|months|teams|services|endpoints|tests)\b|\b\d+(?:\.\d+)?\s*%/i.test(
    bullet,
  );
}

function grade(score: number): HealthReport["grade"] {
  if (score >= 90) return "A";
  if (score >= 78) return "B";
  if (score >= 64) return "C";
  if (score >= 50) return "D";
  return "F";
}

export interface HealthOptions {
  watchlist?: readonly string[];
  /** Target length: interns and new grads should stay on one page. */
  targetPages?: 1 | 2;
}

export function analyzeHealth(
  source: string,
  options: HealthOptions = {},
): HealthReport {
  const { watchlist = [], targetPages = 1 } = options;
  const raw = source ?? "";
  const plain = stripLatex(raw);
  const lower = plain.toLowerCase();
  const bullets = extractBullets(raw);
  const sections = extractSections(raw);
  const wordCount = countWords(raw);
  const checks: HealthCheck[] = [];

  const wordsPerPage = 520;
  const estimatedPages = Number((wordCount / wordsPerPage).toFixed(2));

  // --- 1. Length ----------------------------------------------------------
  {
    const min = targetPages === 1 ? 350 : 700;
    const ideal = targetPages === 1 ? 480 : 950;
    const max = targetPages === 1 ? 620 : 1200;
    let state: CheckState = "pass";
    let score = 1;
    let why = `${wordCount} words — a solid ${targetPages}-page density.`;
    let fix: string | undefined;

    if (wordCount === 0) {
      state = "fail";
      score = 0;
      why = "The document is empty.";
      fix = "Paste or write your resume to begin.";
    } else if (wordCount < min * 0.7) {
      state = "fail";
      score = 0.2;
      why = `${wordCount} words — far too thin for ${targetPages} page${targetPages > 1 ? "s" : ""}.`;
      fix = `Add ${min - wordCount} or so more words: expand impact and scope on your strongest bullets.`;
    } else if (wordCount < min) {
      state = "warn";
      score = 0.6;
      why = `${wordCount} words — a little light; you have room for more detail.`;
      fix = "Add measurable outcomes to your top three bullets rather than adding new sections.";
    } else if (wordCount > max) {
      state = "fail";
      score = 0.25;
      why = `${wordCount} words — this will overflow ${targetPages} page${targetPages > 1 ? "s" : ""}.`;
      fix = `Cut roughly ${wordCount - ideal} words. Start with the oldest role and any bullet without a number.`;
    } else if (wordCount > ideal) {
      state = "warn";
      score = 0.7;
      why = `${wordCount} words — dense; watch the page boundary.`;
      fix = "Tighten wording before adding anything new. Compile to confirm the page count.";
    }
    checks.push({ id: "length", label: "Length", state, score, weight: 1.0, why, fix });
  }

  // --- 2. Quantified bullets ---------------------------------------------
  const quantified = bullets.filter(isQuantified);
  const quantifiedPct = bullets.length ? Math.round((quantified.length / bullets.length) * 100) : 0;
  {
    const unquantified = bullets.filter((b) => !isQuantified(b));
    const state: CheckState =
      bullets.length === 0 ? "fail" : quantifiedPct >= 60 ? "pass" : quantifiedPct >= 35 ? "warn" : "fail";
    checks.push({
      id: "quantified",
      label: "Quantified impact",
      state,
      score: bullets.length === 0 ? 0 : Math.min(1, quantifiedPct / 60),
      weight: 1.5,
      why:
        bullets.length === 0
          ? "No bullet points detected."
          : `${quantified.length} of ${bullets.length} bullets (${quantifiedPct}%) include a concrete number.`,
      fix:
        state === "pass"
          ? undefined
          : "Attach a number to each remaining bullet: latency, throughput, cost, users, or time saved. If you cannot measure the outcome, measure the scope.",
      offenders: unquantified.slice(0, 8),
    });
  }

  // --- 3. Action verbs ----------------------------------------------------
  const strongBullets = bullets.filter((b) => ACTION_VERBS.has(firstWord(b)));
  const actionVerbPct = bullets.length ? Math.round((strongBullets.length / bullets.length) * 100) : 0;
  {
    const weakOpeners = bullets.filter((b) => {
      const w = firstWord(b);
      return WEAK_OPENERS.has(w) || (!ACTION_VERBS.has(w) && w.length > 0);
    });
    const state: CheckState =
      bullets.length === 0 ? "fail" : actionVerbPct >= 85 ? "pass" : actionVerbPct >= 60 ? "warn" : "fail";
    checks.push({
      id: "action-verbs",
      label: "Strong opening verbs",
      state,
      score: bullets.length === 0 ? 0 : Math.min(1, actionVerbPct / 85),
      weight: 1.2,
      why:
        bullets.length === 0
          ? "No bullet points detected."
          : `${strongBullets.length} of ${bullets.length} bullets (${actionVerbPct}%) start with a strong action verb.`,
      fix:
        state === "pass"
          ? undefined
          : "Open every bullet with what you did: Built, Designed, Reduced, Migrated. Drop lead-ins like “Worked on”.",
      offenders: weakOpeners.slice(0, 8),
    });
  }

  // --- 4. Filler phrasing -------------------------------------------------
  {
    const found = FILLER_PHRASES.filter((p) => lower.includes(p));
    const state: CheckState = found.length === 0 ? "pass" : found.length <= 2 ? "warn" : "fail";
    checks.push({
      id: "filler",
      label: "No filler phrasing",
      state,
      score: Math.max(0, 1 - found.length * 0.34),
      weight: 1.0,
      why: found.length ? `Found ${found.length} filler phrase${found.length > 1 ? "s" : ""}.` : "No filler detected.",
      fix: found.length ? "Replace each with the specific thing you did and its result." : undefined,
      offenders: found,
    });
  }

  // --- 5. Contact details -------------------------------------------------
  {
    const hasEmail = /[\w.+-]+@[\w-]+\.[\w.]{2,}/.test(raw);
    const hasPhone = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(raw);
    const hasLinkedIn = /linkedin\.com/i.test(raw);
    const hasGitHub = /github\.com|gitlab\.com/i.test(raw);
    const hasLocation = /\b(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*(?:[A-Z]{2}\b|[A-Z][a-z]+)/.test(plain);

    const present = [hasEmail, hasPhone, hasLinkedIn, hasGitHub, hasLocation];
    const missing = [
      !hasEmail && "email",
      !hasPhone && "phone",
      !hasLinkedIn && "LinkedIn",
      !hasGitHub && "GitHub",
      !hasLocation && "location",
    ].filter(Boolean) as string[];
    const hits = present.filter(Boolean).length;

    // Email is non-negotiable; the rest are graded.
    const state: CheckState = !hasEmail ? "fail" : hits >= 4 ? "pass" : "warn";
    checks.push({
      id: "contact",
      label: "Contact details",
      state,
      score: !hasEmail ? 0 : hits / 5,
      weight: 1.0,
      why: missing.length ? `Missing: ${missing.join(", ")}.` : "Email, phone, location and profile links all present.",
      fix: missing.length ? "Add the missing items to your header. Recruiters filter out resumes they cannot act on." : undefined,
      offenders: missing,
    });
  }

  // --- 6. Watchlist -------------------------------------------------------
  {
    const missing = findMissingTerms(raw, watchlist);
    const state: CheckState =
      watchlist.length === 0 ? "skip" : missing.length === 0 ? "pass" : "fail";
    checks.push({
      id: "watchlist",
      label: "Keyword guardrails",
      state,
      score: watchlist.length === 0 ? 1 : missing.length === 0 ? 1 : Math.max(0, 1 - missing.length / watchlist.length),
      weight: watchlist.length === 0 ? 0 : 1.4,
      why:
        watchlist.length === 0
          ? "No guarded terms set yet."
          : missing.length
            ? `${missing.length} guarded term${missing.length > 1 ? "s have" : " has"} disappeared: ${missing.join(", ")}.`
            : `All ${watchlist.length} guarded terms are present.`,
      fix: missing.length ? "Restore these terms or remove them from your guardrails if they no longer apply." : undefined,
      offenders: missing,
    });
  }

  // --- 7. Bullet length ---------------------------------------------------
  {
    const tooLong = bullets.filter((b) => b.split(/\s+/).length > 38);
    const tooShort = bullets.filter((b) => b.split(/\s+/).length < 6);
    const bad = tooLong.length + tooShort.length;
    const state: CheckState =
      bullets.length === 0 ? "skip" : bad === 0 ? "pass" : bad <= 2 ? "warn" : "fail";
    checks.push({
      id: "bullet-length",
      label: "Bullet readability",
      state,
      score: bullets.length === 0 ? 1 : Math.max(0, 1 - bad / Math.max(1, bullets.length)),
      weight: 0.8,
      why:
        bad === 0
          ? "Every bullet sits in the readable 6–38 word range."
          : `${tooLong.length} bullet${tooLong.length === 1 ? "" : "s"} run long and ${tooShort.length} ${tooShort.length === 1 ? "is" : "are"} too short.`,
      fix: bad ? "Aim for one to two lines per bullet: one action, one mechanism, one result." : undefined,
      offenders: [...tooLong, ...tooShort].slice(0, 6),
    });
  }

  // --- 8. First-person pronouns ------------------------------------------
  {
    const matches = plain.match(FIRST_PERSON) ?? [];
    const state: CheckState = matches.length === 0 ? "pass" : matches.length <= 2 ? "warn" : "fail";
    checks.push({
      id: "pronouns",
      label: "Third-person voice",
      state,
      score: Math.max(0, 1 - matches.length * 0.25),
      weight: 0.6,
      why: matches.length ? `${matches.length} first-person pronoun${matches.length > 1 ? "s" : ""} found.` : "No first-person pronouns.",
      fix: matches.length ? "Resumes are written in implied first person: drop “I” and “we” entirely." : undefined,
      offenders: Array.from(new Set(matches)).slice(0, 6),
    });
  }

  // --- 9. Section completeness -------------------------------------------
  {
    const normalized = sections.map((x) => x.toLowerCase());
    const has = (...keys: string[]) => keys.some((k) => normalized.some((n) => n.includes(k)));
    const hasExperience = has("experience", "employment", "work history");
    const hasEducation = has("education", "academic");
    const hasSkills = has("skill", "technical", "technologies", "competenc");
    const hasProjects = has("project", "portfolio");

    const core = [hasExperience, hasEducation, hasSkills];
    const missing = [
      !hasExperience && "Experience",
      !hasEducation && "Education",
      !hasSkills && "Skills",
    ].filter(Boolean) as string[];
    const state: CheckState = missing.length === 0 ? "pass" : missing.length === 1 ? "warn" : "fail";
    checks.push({
      id: "sections",
      label: "Section structure",
      state,
      score: core.filter(Boolean).length / 3,
      weight: 1.0,
      why: missing.length
        ? `Missing standard section${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`
        : `Found ${sections.length} sections${hasProjects ? ", including Projects" : ""}.`,
      fix: missing.length
        ? "Applicant tracking systems look for these headings by name. Use plain labels like “Experience” and “Education”."
        : undefined,
      offenders: missing,
    });
  }

  // --- 10. Verb variety ---------------------------------------------------
  {
    const openers = bullets.map(firstWord).filter(Boolean);
    const counts = new Map<string, number>();
    for (const v of openers) counts.set(v, (counts.get(v) ?? 0) + 1);
    const repeated = Array.from(counts.entries())
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1]);
    const state: CheckState =
      openers.length === 0 ? "skip" : repeated.length === 0 ? "pass" : repeated.length <= 1 ? "warn" : "fail";
    checks.push({
      id: "verb-variety",
      label: "Verb variety",
      state,
      score: Math.max(0, 1 - repeated.length * 0.3),
      weight: 0.6,
      why: repeated.length
        ? `${repeated.map(([v, n]) => `“${v}” ×${n}`).join(", ")} — repetition dulls impact.`
        : "Opening verbs are varied.",
      fix: repeated.length ? "Swap repeats for verbs that describe the specific contribution more precisely." : undefined,
      offenders: repeated.map(([v]) => v),
    });
  }

  // --- 11. ATS parseability ----------------------------------------------
  {
    const problems: string[] = [];
    if (isLatex(raw)) {
      if (/\\begin\{(?:tabular|tabu|longtable)\}/.test(raw)) {
        problems.push("tables (tabular)");
      }
      if (/\\begin\{multicols\}|\\columnbreak|\\twocolumn/.test(raw)) {
        problems.push("multi-column layout");
      }
      if (/\\includegraphics/.test(raw)) problems.push("images");
      if (/\\fancyhead|\\fancyfoot|\\lhead|\\rhead/.test(raw)) {
        problems.push("header/footer content");
      }
      if (/\\begin\{tikzpicture\}/.test(raw)) problems.push("vector graphics");
    }
    // Glyphs that frequently survive PDF extraction as mojibake.
    const risky = plain.match(/[■●▪◆★☆♦→⇒✔✗]/g) ?? [];
    if (risky.length > 0) problems.push(`${risky.length} decorative glyph${risky.length > 1 ? "s" : ""}`);

    const state: CheckState = problems.length === 0 ? "pass" : problems.length <= 1 ? "warn" : "fail";
    checks.push({
      id: "ats",
      label: "ATS parseability",
      state,
      score: Math.max(0, 1 - problems.length * 0.35),
      weight: 1.3,
      why: problems.length
        ? `Contains ${problems.join(", ")} — these often garble in resume parsers.`
        : "Single-column, text-first layout parses cleanly.",
      fix: problems.length
        ? "Keep contact details in the document body, not headers, and express structure with plain sections instead of tables or columns."
        : undefined,
      offenders: problems,
    });
  }

  // --- 12. Date coverage --------------------------------------------------
  {
    const dateRanges =
      plain.match(
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\s*(?:--|–|—|-|to)\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|Present|Current|Now)/gi,
      ) ?? [];
    const bareYears = plain.match(/\b(?:19|20)\d{2}\s*(?:--|–|—|-|to)\s*(?:(?:19|20)\d{2}|Present)/gi) ?? [];
    const total = dateRanges.length + bareYears.length;
    const state: CheckState = total >= 2 ? "pass" : total === 1 ? "warn" : "fail";
    checks.push({
      id: "dates",
      label: "Dated history",
      state,
      score: Math.min(1, total / 2),
      weight: 0.8,
      why: total ? `${total} dated entr${total === 1 ? "y" : "ies"} found.` : "No date ranges detected.",
      fix: total >= 2 ? undefined : "Give every role and degree an explicit start and end (e.g. Jun 2026 – Aug 2026). Parsers use these to compute your years of experience.",
    });
  }

  // --- 13. Technology capitalization -------------------------------------
  {
    const wrong: string[] = [];
    for (const rule of CAPITALIZATION_RULES) {
      // Match against the plain text with original casing preserved.
      const re = new RegExp(rule.wrong.source, rule.wrong.flags.replace("i", ""));
      if (re.test(plain) && !plain.includes(rule.right)) wrong.push(rule.right);
    }
    const unique = Array.from(new Set(wrong));
    const state: CheckState = unique.length === 0 ? "pass" : unique.length <= 2 ? "warn" : "fail";
    checks.push({
      id: "capitalization",
      label: "Technology naming",
      state,
      score: Math.max(0, 1 - unique.length * 0.25),
      weight: 0.5,
      why: unique.length
        ? `Non-standard capitalization for: ${unique.join(", ")}.`
        : "Technology names are capitalized correctly.",
      fix: unique.length ? "Match each vendor's own spelling — engineers notice, and some parsers match case-sensitively." : undefined,
      offenders: unique,
    });
  }

  // --- 14. Passive voice --------------------------------------------------
  {
    const matches = plain.match(PASSIVE_VOICE) ?? [];
    const ratio = bullets.length ? matches.length / bullets.length : 0;
    const state: CheckState =
      bullets.length === 0 ? "skip" : ratio <= 0.1 ? "pass" : ratio <= 0.25 ? "warn" : "fail";
    checks.push({
      id: "passive-voice",
      label: "Active voice",
      state,
      score: Math.max(0, 1 - ratio * 3),
      weight: 0.6,
      why: matches.length
        ? `${matches.length} passive construction${matches.length > 1 ? "s" : ""} detected.`
        : "Consistently active voice.",
      fix: matches.length ? "Rewrite so you are the subject: “Reduced latency 30%”, not “Latency was reduced”." : undefined,
      offenders: Array.from(new Set(matches)).slice(0, 6),
    });
  }

  // --- Weighted score -----------------------------------------------------
  const scored = checks.filter((c) => c.state !== "skip" && c.weight > 0);
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0);
  const earned = scored.reduce((sum, c) => sum + c.score * c.weight, 0);
  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;

  return {
    score,
    grade: grade(score),
    checks,
    wordCount,
    bulletCount: bullets.length,
    sectionCount: sections.length,
    quantifiedPct,
    actionVerbPct,
    estimatedPages,
  };
}

/** Skills detected in a resume, used to seed guardrails and profile hints. */
export function detectSkills(source: string): string[] {
  const haystack = `${stripLatex(source ?? "")}\n${source ?? ""}`.toLowerCase();
  const found: string[] = [];
  for (const skill of SKILLS) {
    const surfaces = [skill.canonical, ...skill.aliases];
    if (surfaces.some((s) => new RegExp(`(?<![a-z0-9+#])${s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9+#])`, "i").test(haystack))) {
      found.push(skill.canonical);
    }
  }
  return found;
}
