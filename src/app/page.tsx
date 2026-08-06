import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Check,
  GitBranch,
  Lock,
  Shield,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { currentUser } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shell/logo";
import { Badge } from "@/components/ui/badge";

export default async function LandingPage() {
  // Signed-in visitors have no use for the pitch.
  if (await currentUser()) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link href="/sign-in">
                Get started <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 text-center">
          <Badge tone="primary" mono className="mb-5">
            <GitBranch className="size-3" /> Version control for your job search
          </Badge>

          <h1 className="font-display mx-auto max-w-4xl text-[clamp(2.2rem,6vw,3.75rem)] leading-[1.05] font-bold tracking-[-0.03em]">
            Know exactly which resume
            <br />
            you sent to whom.
          </h1>

          <p className="text-ink-2 mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed">
            Trackfolio treats your resume like source code: a protected master, a
            branch per company, and an immutable snapshot of the exact document
            every employer received. So when the interview call comes six weeks
            later, you are preparing from what they actually read.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/sign-in">
                Start free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/guide">See how it works</Link>
            </Button>
          </div>

          <p className="text-ink-3 mt-4 font-mono text-[11px]">
            Free · No credit card · Export everything, any time
          </p>
        </section>

        {/* The problem */}
        <section className="border-line bg-surface border-y">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <p className="text-eyebrow mb-2">The problem</p>
                <h2 className="font-display text-[24px] leading-tight font-bold tracking-[-0.02em]">
                  Tailoring your resume quietly destroys your history.
                </h2>
                <p className="text-ink-2 mt-3 text-[14.5px] leading-relaxed">
                  You rewrite a bullet for one company, overwrite the file, and
                  the previous version is gone. Six weeks later a recruiter asks
                  about a project that is no longer on the document in front of
                  you — and you have no idea what they are looking at.
                </p>
              </div>
              <ul className="space-y-2.5">
                {[
                  "The version you sent no longer exists on disk",
                  "A keyword you rely on vanished during tailoring",
                  "The job posting was taken down before your interview",
                  "You cannot tell which resume actually gets callbacks",
                ].map((problem) => (
                  <li
                    key={problem}
                    className="bg-bad-soft border-bad-border text-ink flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-[13.5px]"
                  >
                    <span className="text-bad mt-px font-bold" aria-hidden>
                      ✕
                    </span>
                    {problem}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-10 text-center">
            <p className="text-eyebrow mb-2">What you get</p>
            <h2 className="font-display text-[26px] font-bold tracking-[-0.02em]">
              An operating system, not a spreadsheet
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-surface border-line hover:border-line-2 rounded-[var(--radius-lg)] border p-5 transition-colors"
              >
                <feature.icon className="text-primary mb-3 size-5" aria-hidden />
                <h3 className="text-[14.5px] font-semibold">{feature.title}</h3>
                <p className="text-ink-2 mt-1.5 text-[13px] leading-relaxed">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Honesty guarantee */}
        <section className="border-line bg-surface border-y">
          <div className="mx-auto max-w-3xl px-5 py-14 text-center">
            <Shield className="text-ok mx-auto mb-4 size-7" aria-hidden />
            <h2 className="font-display text-[24px] font-bold tracking-[-0.02em]">
              AI that refuses to lie on your behalf
            </h2>
            <p className="text-ink-2 mx-auto mt-3 max-w-2xl text-[14.5px] leading-relaxed">
              Every AI feature is grounded in the resume you actually wrote. It
              will rewrite a weak bullet, surface a real gap, and tell you how to
              honestly frame adjacent experience. It will never invent an
              employer, a technology, or a metric you did not give it — because
              the fastest way to fail an interview is to be asked about
              something you cannot defend.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                "Grounded in your source document",
                "Gaps reported, never fabricated",
                "Every suggestion is reviewable",
              ].map((claim) => (
                <span
                  key={claim}
                  className="bg-ok-soft text-ok inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium"
                >
                  <Check className="size-3" aria-hidden />
                  {claim}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="font-display text-[28px] font-bold tracking-[-0.02em]">
            Your search deserves better than a folder of{" "}
            <span className="font-mono text-[24px]">resume_final_v3.pdf</span>
          </h2>
          <Button variant="primary" size="lg" className="mt-7" asChild>
            <Link href="/sign-in">
              Get started free <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-line border-t">
        <div className="text-ink-3 mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-[12px] sm:flex-row">
          <span>© {new Date().getFullYear()} Trackfolio</span>
          <div className="flex items-center gap-4">
            <Link href="/guide" className="hover:text-ink transition-colors">
              Guide
            </Link>
            <Link href="/privacy" className="hover:text-ink transition-colors">
              Privacy
            </Link>
            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
              <Lock className="size-3" aria-hidden /> Your data stays yours
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: GitBranch,
    title: "Branch-per-company resumes",
    body: "A protected master plus a tailored branch for every application. Diff any two versions before you send, so nothing important disappears silently.",
  },
  {
    icon: Lock,
    title: "Immutable submission snapshots",
    body: "The moment you apply, the exact resume, cover letter and job posting are frozen against that application — permanently, even if you later delete the version.",
  },
  {
    icon: Target,
    title: "Honest fit analysis",
    body: "Fourteen deterministic resume checks and tiered requirement matching that knows “k8s” and “Kubernetes” are the same thing, so it never invents a gap.",
  },
  {
    icon: Sparkles,
    title: "Grounded AI assistance",
    body: "Rewrite bullets, find real gaps, draft cover letters and generate interview questions — all constrained to what your resume actually says.",
  },
  {
    icon: Zap,
    title: "An action queue that thinks",
    body: "Overdue follow-ups, applications gone quiet, interviews this week and missing snapshots, ranked so you always know the next best move.",
  },
  {
    icon: BarChart3,
    title: "Conversion analytics",
    body: "Which resume profile and which sourcing channel actually convert. Small samples are labelled, so you never over-fit your strategy to one lucky callback.",
  },
] as const;
