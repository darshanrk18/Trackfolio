import { describe, expect, it } from "vitest";
import {
  analyzeHealth,
  detectSkills,
  type CheckId,
  type HealthCheck,
  type HealthReport,
} from "./health";

function checkOf(report: HealthReport, id: CheckId): HealthCheck {
  const found = report.checks.find((c) => c.id === id);
  if (!found) throw new Error(`no check with id "${id}"`);
  return found;
}

/** A LaTeX resume that should clear every check. */
const STRONG_RESUME = String.raw`\documentclass[letterpaper,11pt]{article}
\usepackage[margin=0.6in]{geometry}

\begin{document}

\textbf{Darshan Konnur} \\
Seattle, WA \\
darshan.konnur@example.com \\
(206) 555-0142 \\
\href{https://linkedin.com/in/darshankonnur}{\underline{linkedin.com/in/darshankonnur}} \\
\href{https://github.com/darshankonnur}{\underline{github.com/darshankonnur}}

\section{Experience}

\textbf{Senior Software Engineer}, Northwind Systems \\
Payments platform group, Seattle \\
Jun 2023 -- Present

\begin{itemize}
  \item Reduced checkout API latency from 820 ms to 180 ms by rewriting the pricing resolver and caching hot lookups in Redis.
  \item Migrated the payments platform from EC2 onto Kubernetes, cutting monthly infrastructure spend by 31\% across every region.
  \item Designed an event-driven ingestion pipeline that sustains 1,800 requests per second with a durable Kafka backbone.
  \item Built a Terraform module library adopted by 8 teams, removing roughly 4,000 lines of duplicated configuration.
  \item Mentored 6 engineers through their first production launches, and 4 of them earned promotions the following year.
  \item Automated release verification with 320 regression checks, catching 12 defects before they ever reached customers.
\end{itemize}

\textbf{Software Engineer}, Contoso Analytics \\
Data products group, remote \\
Jul 2021 -- May 2023

\begin{itemize}
  \item Instrumented the billing service with OpenTelemetry traces, cutting median incident diagnosis time by 62\% overall.
  \item Refactored a legacy monolith into 5 bounded services, dropping the change failure rate from 18\% to 4\% in a quarter.
  \item Standardized code review guidelines across 3 teams, shortening median pull request turnaround to 6 hours.
  \item Launched a self-serve analytics portal that reached 2,400 internal users during its first full quarter.
  \item Tuned PostgreSQL query plans and added partial indexes, dropping p99 read latency by 74\% on the busiest tables.
  \item Documented the deployment runbook, shrinking ramp-up time for new engineers from 3 weeks to 4 days.
\end{itemize}

\section{Projects}

\textbf{Ratelimiter} \\
\begin{itemize}
  \item Engineered a distributed token bucket in Go that shields 40 services from sudden downstream traffic spikes.
  \item Prototyped a semantic search index over 120,000 documents, returning ranked results in under 90 ms per query.
  \item Optimized a nightly batch scoring job with vectorized NumPy operations, trimming total runtime by 87\% overall.
  \item Published an open source command line tool that surpassed 3,000 downloads within its first month on the registry.
  \item Scaled the notification fanout to 250,000 messages per minute by sharding the outbox table across 6 partitions.
  \item Hardened the public API with per-tenant quotas, blocking 9,000 abusive requests during the first launch week.
\end{itemize}

\section{Technical Skills}

Languages: Python, TypeScript, Go, Java, SQL, Bash, Kotlin, Scala \\
Frameworks: React, Next.js, FastAPI, Spring Boot, Express, Flask, Django, Tailwind CSS \\
Infrastructure: AWS, Kubernetes, Docker, Terraform, Kafka, Redis, PostgreSQL, GitHub Actions, Helm, ArgoCD, Nginx \\
Observability: Prometheus, Grafana, OpenTelemetry, Datadog, Sentry, PagerDuty \\
Data: Airflow, Spark, dbt, Snowflake, BigQuery, Elasticsearch, Pandas \\
Testing: PyTest, Jest, Playwright, Cypress, JUnit, Selenium, Mockito \\
Practices: distributed systems, system design, code review, technical writing, threat modeling, incident response

\section{Education}

\textbf{University of Washington} \\
B.S. Computer Science, Seattle, WA \\
Sep 2017 -- Jun 2021 \\
Cumulative grade point average of 3.87, with six quarters on the Dean list \\
Coursework: distributed systems, compilers, databases, operating systems, machine learning, computer networks

\end{document}`;

/** Markdown resumes are the cheapest way to trigger one check at a time. */
function bullets(...lines: string[]): string {
  return lines.map((l) => `- ${l}`).join("\n");
}

describe("analyzeHealth", () => {
  it("does not throw on an empty document and scores it low", () => {
    const report = analyzeHealth("");
    expect(report.score).toBeLessThan(50);
    expect(report.grade).toBe("F");
    expect(report.wordCount).toBe(0);
    expect(report.bulletCount).toBe(0);
    expect(report.sectionCount).toBe(0);
    expect(report.quantifiedPct).toBe(0);
    expect(report.actionVerbPct).toBe(0);
  });

  it("scores a well-formed resume highly", () => {
    const report = analyzeHealth(STRONG_RESUME);
    expect(report.score).toBeGreaterThanOrEqual(75);
    expect(["A", "B"]).toContain(report.grade);
    expect(report.wordCount).toBe(413);
    expect(report.bulletCount).toBe(18);
    expect(report.quantifiedPct).toBe(100);
    expect(report.actionVerbPct).toBe(100);
    expect(
      report.checks.filter((c) => c.state !== "pass" && c.state !== "skip").map((c) => c.id),
    ).toEqual([]);
  });

  it("reports the derived counts alongside the score", () => {
    const report = analyzeHealth(STRONG_RESUME);
    expect(report.sectionCount).toBe(4);
    expect(report.estimatedPages).toBeGreaterThan(0);
    expect(report.estimatedPages).toBeLessThan(2);
  });

  it("emits every check exactly once", () => {
    const ids = analyzeHealth(STRONG_RESUME).checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "length",
        "quantified",
        "action-verbs",
        "filler",
        "contact",
        "watchlist",
        "bullet-length",
        "pronouns",
        "sections",
        "verb-variety",
        "ats",
        "dates",
        "capitalization",
        "passive-voice",
      ]),
    );
  });
});

describe("individual checks", () => {
  describe("length", () => {
    it("fails an empty document", () => {
      expect(checkOf(analyzeHealth(""), "length").state).toBe("fail");
    });

    it("fails a document that is far too thin", () => {
      expect(checkOf(analyzeHealth("impact ".repeat(100)), "length").state).toBe("fail");
    });

    it("warns on a slightly light document", () => {
      expect(checkOf(analyzeHealth("impact ".repeat(300)), "length").state).toBe("warn");
    });

    it("passes a document at one-page density", () => {
      expect(checkOf(analyzeHealth("impact ".repeat(420)), "length").state).toBe("pass");
    });

    it("fails a document that overflows the page target", () => {
      expect(checkOf(analyzeHealth("impact ".repeat(1000)), "length").state).toBe("fail");
    });

    it("honours a two-page target", () => {
      const source = "impact ".repeat(900);
      expect(checkOf(analyzeHealth(source, { targetPages: 2 }), "length").state).toBe("pass");
      expect(checkOf(analyzeHealth(source), "length").state).toBe("fail");
    });
  });

  describe("quantified", () => {
    it("fails when no bullet carries a number", () => {
      const report = analyzeHealth(
        bullets(
          "Improved the deployment process for the platform team",
          "Designed a new onboarding flow for enterprise customers",
        ),
      );
      const check = checkOf(report, "quantified");
      expect(check.state).toBe("fail");
      expect(report.quantifiedPct).toBe(0);
      expect(check.offenders).toHaveLength(2);
    });

    it("passes when most bullets are quantified", () => {
      const report = analyzeHealth(
        bullets(
          "Reduced page load time to 180 ms across the storefront",
          "Migrated 1,200 records into the new warehouse schema",
          "Designed a new onboarding flow for enterprise customers",
        ),
      );
      expect(checkOf(report, "quantified").state).toBe("pass");
      expect(report.quantifiedPct).toBe(67);
    });

    it("fails when there are no bullets at all", () => {
      expect(checkOf(analyzeHealth("A paragraph with no list."), "quantified").state).toBe("fail");
    });

    it("recognises a LaTeX-escaped percentage", () => {
      const report = analyzeHealth("\\item Reduced page load time by 42\\% across the storefront");
      expect(report.quantifiedPct).toBe(100);
    });

    it("recognises a bare percentage in a plain-text bullet", () => {
      const report = analyzeHealth(bullets("Reduced page load time by 42% across the storefront"));
      expect(report.bulletCount).toBe(1);
      expect(report.quantifiedPct).toBe(100);
    });
  });

  describe("action-verbs", () => {
    it("fails when bullets open with weak verbs", () => {
      const report = analyzeHealth(
        bullets(
          "Worked on the deployment pipeline for several quarters",
          "Helped with onboarding for 12 new engineers each quarter",
          "Was involved in the nightly batch jobs and 20 reports",
        ),
      );
      const check = checkOf(report, "action-verbs");
      expect(check.state).toBe("fail");
      expect(report.actionVerbPct).toBe(0);
      expect(check.offenders!.length).toBeGreaterThan(0);
    });

    it("passes when every bullet opens with an action verb", () => {
      const report = analyzeHealth(
        bullets(
          "Built a 40 node ingestion cluster on Kubernetes",
          "Reduced p99 latency to 55 ms with better indexing",
        ),
      );
      expect(checkOf(report, "action-verbs").state).toBe("pass");
      expect(report.actionVerbPct).toBe(100);
    });
  });

  describe("filler", () => {
    it("warns on a single filler phrase", () => {
      const check = checkOf(
        analyzeHealth("Responsible for the weekly release process."),
        "filler",
      );
      expect(check.state).toBe("warn");
      expect(check.offenders).toEqual(["responsible for"]);
    });

    it("fails on several filler phrases", () => {
      const check = checkOf(
        analyzeHealth(
          "Responsible for releases. A hard worker and team player who worked on many things.",
        ),
        "filler",
      );
      expect(check.state).toBe("fail");
      expect(check.offenders!.length).toBeGreaterThan(2);
    });

    it("passes clean prose", () => {
      expect(checkOf(analyzeHealth("Shipped the release pipeline."), "filler").state).toBe("pass");
    });
  });

  describe("contact", () => {
    it("fails when there is no email address", () => {
      const check = checkOf(analyzeHealth("Darshan Konnur, Seattle, WA"), "contact");
      expect(check.state).toBe("fail");
      expect(check.score).toBe(0);
      expect(check.offenders).toContain("email");
    });

    it("warns when only some contact details are present", () => {
      const check = checkOf(analyzeHealth("darshan@example.com"), "contact");
      expect(check.state).toBe("warn");
      expect(check.offenders).toEqual(["phone", "LinkedIn", "GitHub", "location"]);
    });

    it("passes with a complete header", () => {
      const check = checkOf(
        analyzeHealth(
          "Darshan Konnur\nSeattle, WA\ndarshan@example.com\n(206) 555-0142\nlinkedin.com/in/dk\ngithub.com/dk",
        ),
        "contact",
      );
      expect(check.state).toBe("pass");
      expect(check.offenders).toEqual([]);
    });
  });

  describe("watchlist", () => {
    it("is skipped and unweighted when no terms are guarded", () => {
      const check = checkOf(analyzeHealth(STRONG_RESUME), "watchlist");
      expect(check.state).toBe("skip");
      expect(check.weight).toBe(0);
    });

    it("is skipped when the watchlist is explicitly empty", () => {
      const check = checkOf(analyzeHealth(STRONG_RESUME, { watchlist: [] }), "watchlist");
      expect(check.state).toBe("skip");
      expect(check.weight).toBe(0);
    });

    it("fails when a guarded term has disappeared", () => {
      const check = checkOf(
        analyzeHealth("Shipped Rust services.", { watchlist: ["Kubernetes", "Terraform"] }),
        "watchlist",
      );
      expect(check.state).toBe("fail");
      expect(check.weight).toBe(1.4);
      expect(check.offenders).toEqual(["Kubernetes", "Terraform"]);
    });

    it("passes when an alias of the guarded term is present", () => {
      const check = checkOf(
        analyzeHealth("Ran k8s clusters in production.", { watchlist: ["Kubernetes"] }),
        "watchlist",
      );
      expect(check.state).toBe("pass");
      expect(check.offenders).toEqual([]);
    });
  });

  describe("bullet-length", () => {
    const longBullet = Array.from({ length: 45 }, (_, i) => `word${i}`).join(" ");

    it("is skipped when there are no bullets", () => {
      expect(checkOf(analyzeHealth("Prose only."), "bullet-length").state).toBe("skip");
    });

    it("warns on a couple of badly sized bullets", () => {
      const check = checkOf(
        analyzeHealth(
          bullets(
            longBullet,
            "Too short",
            "Reduced p99 latency to 180 ms with a smarter cache key",
            "Migrated 12 services onto the shared build pipeline",
          ),
        ),
        "bullet-length",
      );
      expect(check.state).toBe("warn");
      expect(check.offenders!.length).toBe(2);
    });

    it("fails when several bullets are badly sized", () => {
      const check = checkOf(
        analyzeHealth(bullets(longBullet, "Too short", "Also short", "Shipped it")),
        "bullet-length",
      );
      expect(check.state).toBe("fail");
    });

    it("passes when every bullet is readable", () => {
      const check = checkOf(
        analyzeHealth(
          bullets(
            "Reduced p99 latency to 180 ms with a smarter cache key",
            "Migrated 12 services onto the shared build pipeline",
          ),
        ),
        "bullet-length",
      );
      expect(check.state).toBe("pass");
    });
  });

  describe("pronouns", () => {
    it("fails on repeated first-person voice", () => {
      const check = checkOf(
        analyzeHealth("I led the team, I owned my roadmap, and we shipped it."),
        "pronouns",
      );
      expect(check.state).toBe("fail");
      expect(check.offenders).toEqual(expect.arrayContaining(["I", "my", "we"]));
    });

    it("warns on an isolated pronoun", () => {
      expect(checkOf(analyzeHealth("I shipped the release pipeline."), "pronouns").state).toBe("warn");
    });

    it("passes third-person prose", () => {
      expect(checkOf(analyzeHealth("Shipped the release pipeline."), "pronouns").state).toBe("pass");
    });

    it("detects sentence-initial capitalized pronouns", () => {
      const check = checkOf(
        analyzeHealth("We shipped the service. My team owned it. Our uptime improved."),
        "pronouns",
      );
      expect(check.state).toBe("fail");
    });
  });

  describe("sections", () => {
    it("fails when the standard headings are missing", () => {
      const check = checkOf(analyzeHealth("Some prose without headings."), "sections");
      expect(check.state).toBe("fail");
      expect(check.offenders).toEqual(["Experience", "Education", "Skills"]);
    });

    it("warns when one standard heading is missing", () => {
      const check = checkOf(
        analyzeHealth("\\section{Experience}\nx\n\\section{Education}\ny"),
        "sections",
      );
      expect(check.state).toBe("warn");
      expect(check.offenders).toEqual(["Skills"]);
    });

    it("passes when all three are present", () => {
      const check = checkOf(
        analyzeHealth(
          "\\section{Experience}\nx\n\\section{Education}\ny\n\\section{Technical Skills}\nz",
        ),
        "sections",
      );
      expect(check.state).toBe("pass");
      expect(check.offenders).toEqual([]);
    });
  });

  describe("verb-variety", () => {
    it("is skipped when there are no bullets", () => {
      expect(checkOf(analyzeHealth("Prose only."), "verb-variety").state).toBe("skip");
    });

    it("warns when one verb is overused", () => {
      const check = checkOf(
        analyzeHealth(
          bullets(
            "Built the ingestion pipeline for 12 sources",
            "Built the alerting rules for 20 services",
            "Built the internal dashboard used by 30 people",
            "Reduced p99 latency to 180 ms with a smarter cache",
          ),
        ),
        "verb-variety",
      );
      expect(check.state).toBe("warn");
      expect(check.offenders).toEqual(["built"]);
    });

    it("fails when several verbs are overused", () => {
      const check = checkOf(
        analyzeHealth(
          bullets(
            "Built the ingestion pipeline for 12 sources",
            "Built the alerting rules for 20 services",
            "Built the internal dashboard used by 30 people",
            "Led the migration of 8 services to Kubernetes",
            "Led the incident review process for 6 quarters",
            "Led the hiring loop for 15 engineering candidates",
          ),
        ),
        "verb-variety",
      );
      expect(check.state).toBe("fail");
      expect(check.offenders).toEqual(expect.arrayContaining(["built", "led"]));
    });

    it("passes when openers are varied", () => {
      const check = checkOf(
        analyzeHealth(
          bullets(
            "Built the ingestion pipeline for 12 sources",
            "Reduced p99 latency to 180 ms with a smarter cache",
            "Migrated 8 services onto the shared platform",
          ),
        ),
        "verb-variety",
      );
      expect(check.state).toBe("pass");
    });
  });

  describe("ats", () => {
    it("warns on a single parser hazard", () => {
      const check = checkOf(
        analyzeHealth("\\section{Experience}\n\\begin{tabular}{ll}\na & b \\\\\n\\end{tabular}"),
        "ats",
      );
      expect(check.state).toBe("warn");
      expect(check.offenders).toEqual(["tables (tabular)"]);
    });

    it("fails when several hazards stack up", () => {
      const check = checkOf(
        analyzeHealth(
          "\\section{Experience}\n\\begin{tabular}{ll}a & b\\end{tabular}\n\\includegraphics{me.png}\n\\fancyhead{contact}",
        ),
        "ats",
      );
      expect(check.state).toBe("fail");
      expect(check.offenders!.length).toBeGreaterThan(1);
    });

    it("flags decorative glyphs that garble in parsers", () => {
      const check = checkOf(analyzeHealth("★ Led the platform team"), "ats");
      expect(check.state).toBe("warn");
      expect(check.offenders!.join()).toContain("decorative glyph");
    });

    it("passes a single-column text-first document", () => {
      expect(checkOf(analyzeHealth(STRONG_RESUME), "ats").state).toBe("pass");
    });
  });

  describe("dates", () => {
    it("fails when nothing is dated", () => {
      expect(checkOf(analyzeHealth("Northwind Systems, Senior Engineer"), "dates").state).toBe("fail");
    });

    it("warns on a single dated entry", () => {
      expect(checkOf(analyzeHealth("Northwind Systems, Jan 2020 - Dec 2021"), "dates").state).toBe("warn");
    });

    it("passes with two or more dated entries", () => {
      const check = checkOf(
        analyzeHealth("Northwind, Jan 2020 - Dec 2021\nContoso, Feb 2022 - Present"),
        "dates",
      );
      expect(check.state).toBe("pass");
      expect(check.fix).toBeUndefined();
    });

    it("accepts bare year ranges", () => {
      expect(checkOf(analyzeHealth("2017 - 2021\n2021 - Present"), "dates").state).toBe("pass");
    });
  });

  describe("capitalization", () => {
    it("fails when several technology names are miscased", () => {
      const check = checkOf(
        analyzeHealth("Built services with javascript, python and kubernetes at scale."),
        "capitalization",
      );
      expect(check.state).toBe("fail");
      expect(check.offenders).toEqual(
        expect.arrayContaining(["JavaScript", "Python", "Kubernetes"]),
      );
    });

    it("warns on a single miscased name", () => {
      const check = checkOf(analyzeHealth("Shipped a graphql gateway."), "capitalization");
      expect(check.state).toBe("warn");
      expect(check.offenders).toEqual(["GraphQL"]);
    });

    it("does not flag a name that also appears correctly cased", () => {
      const check = checkOf(
        analyzeHealth("Used Python daily; the python interpreter was embedded."),
        "capitalization",
      );
      expect(check.state).toBe("pass");
    });

    it("passes correctly capitalized names", () => {
      expect(
        checkOf(analyzeHealth("Built with TypeScript, PostgreSQL and Docker."), "capitalization").state,
      ).toBe("pass");
    });
  });

  describe("passive-voice", () => {
    it("is skipped when there are no bullets", () => {
      expect(checkOf(analyzeHealth("The service was rebuilt."), "passive-voice").state).toBe("skip");
    });

    it("fails when most bullets are passive", () => {
      const check = checkOf(
        analyzeHealth(
          bullets(
            "The pipeline was rebuilt by the platform team over 2 quarters",
            "Latency was reduced across the fleet to 180 ms",
            "Reports were generated nightly for 40 stakeholders",
            "Shipped the new dashboard to 12 teams",
          ),
        ),
        "passive-voice",
      );
      expect(check.state).toBe("fail");
      expect(check.offenders!.length).toBeGreaterThan(0);
    });

    it("passes consistently active bullets", () => {
      const check = checkOf(
        analyzeHealth(
          bullets(
            "Rebuilt the pipeline with the platform team over 2 quarters",
            "Reduced fleet latency to 180 ms with a smarter cache key",
          ),
        ),
        "passive-voice",
      );
      expect(check.state).toBe("pass");
      expect(check.fix).toBeUndefined();
    });
  });
});

describe("health invariants", () => {
  const FIXTURES: Array<[string, string, Parameters<typeof analyzeHealth>[1]?]> = [
    ["empty", ""],
    ["whitespace only", "   \n\t\n   "],
    ["strong resume", STRONG_RESUME],
    ["strong resume with guardrails", STRONG_RESUME, { watchlist: ["Kubernetes", "Rust"] }],
    ["plain prose", "Dear hiring manager, I am writing to apply for the role."],
    ["markdown bullets", bullets("Worked on things", "Helped with other things")],
    ["only latex macros", "\\documentclass{article}\n\\usepackage{geometry}\n\\begin{document}\n\\end{document}"],
    ["only punctuation", "-- ,, ;; !! ?? ... "],
    ["very long document", "lorem ipsum dolor sit amet consectetur ".repeat(1300)],
    ["single long token", "x".repeat(50_000)],
    ["two page target", STRONG_RESUME, { targetPages: 2 }],
  ];

  for (const [name, source, options] of FIXTURES) {
    describe(name, () => {
      it("produces a score in [0, 100] that is never NaN", () => {
        const report = analyzeHealth(source, options);
        expect(Number.isNaN(report.score)).toBe(false);
        expect(Number.isInteger(report.score)).toBe(true);
        expect(report.score).toBeGreaterThanOrEqual(0);
        expect(report.score).toBeLessThanOrEqual(100);
        expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
        expect(Number.isNaN(report.estimatedPages)).toBe(false);
      });

      // Product invariant: a failing check without a remedy is just anxiety.
      it("gives every warning or failure a non-empty fix", () => {
        for (const check of analyzeHealth(source, options).checks) {
          if (check.state === "warn" || check.state === "fail") {
            expect(check.fix, `${check.id} is "${check.state}" with no fix`).toBeTruthy();
            expect(check.fix!.trim().length).toBeGreaterThan(0);
          }
        }
      });

      it("keeps every check score in [0, 1] with a non-negative weight", () => {
        for (const check of analyzeHealth(source, options).checks) {
          expect(Number.isNaN(check.score), `${check.id} score is NaN`).toBe(false);
          expect(check.score).toBeGreaterThanOrEqual(0);
          expect(check.score).toBeLessThanOrEqual(1);
          expect(check.weight).toBeGreaterThanOrEqual(0);
          expect(check.why.length).toBeGreaterThan(0);
        }
      });
    });
  }

  it("never lets a passing check carry a fix", () => {
    for (const [, source, options] of FIXTURES) {
      for (const check of analyzeHealth(source, options).checks) {
        if (check.state === "pass") expect(check.fix).toBeUndefined();
      }
    }
  });

  it("stays fast on a very large document", () => {
    const started = performance.now();
    analyzeHealth(STRONG_RESUME.repeat(20));
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe("detectSkills", () => {
  it("returns nothing for an empty document", () => {
    expect(detectSkills("")).toEqual([]);
  });

  it("detects canonical names and aliases alike", () => {
    const found = detectSkills("Ran k8s clusters, wrote golang services, tuned a postgres replica.");
    expect(found).toContain("Kubernetes");
    expect(found).toContain("Go");
    expect(found).toContain("PostgreSQL");
  });

  it("does not report substring lookalikes", () => {
    const found = detectSkills("Interned at Google and shipped a Django app.");
    expect(found).toContain("Django");
    expect(found).not.toContain("Go");
  });

  it("looks inside LaTeX macro arguments", () => {
    expect(detectSkills("\\skillLine{Languages}{Rust, Elixir}")).toEqual(
      expect.arrayContaining(["Rust", "Elixir"]),
    );
  });

  it("returns each skill at most once", () => {
    const found = detectSkills("Rust Rust Rust and more Rust");
    expect(found.filter((s) => s === "Rust")).toHaveLength(1);
  });

  it("finds the headline skills in a full resume", () => {
    const found = detectSkills(STRONG_RESUME);
    expect(found).toEqual(
      expect.arrayContaining(["Python", "TypeScript", "Kubernetes", "Terraform", "PostgreSQL"]),
    );
  });
});
