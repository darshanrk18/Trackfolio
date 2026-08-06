import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How Trackfolio works",
  description: "A two-minute tour of the Trackfolio workflow.",
};

const STEPS = [
  {
    n: "01",
    title: "Protect a master resume",
    body: "Paste your LaTeX source into Resume Lab. The master branch is locked so tailoring for one company can never quietly overwrite the canonical document.",
  },
  {
    n: "02",
    title: "Branch per company",
    body: "Create a branch named after the company and role. Keyword guardrails flag terms that vanished while you tailored. Diff against master before you send.",
  },
  {
    n: "03",
    title: "Freeze the submission",
    body: "When you apply, capture a snapshot. The exact resume, cover letter and job posting are copied onto that application — permanently, even if you later delete the version.",
  },
  {
    n: "04",
    title: "Prepare from what they read",
    body: "Interview prep is grounded in the frozen snapshot, not today's working copy. When the call comes six weeks later, you know which bullets they saw.",
  },
  {
    n: "05",
    title: "Learn what converts",
    body: "Analytics report interview rate by resume profile and sourcing channel. Small samples are labelled so you never overfit to one lucky callback.",
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-dvh">
      <header className="border-line border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Logo href="/" />
          <Button variant="primary" size="sm" asChild>
            <Link href="/sign-in">Get started</Link>
          </Button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-eyebrow mb-2">Two-minute tour</p>
        <h1 className="font-display text-[32px] font-bold tracking-[-0.03em]">
          How Trackfolio works
        </h1>
        <p className="text-ink-2 mt-3 max-w-[62ch] text-[15px] leading-relaxed">
          Trackfolio treats a job search like a codebase: a protected master, a
          branch per company, and an immutable commit for every document a
          recruiter actually received.
        </p>
        <ol className="mt-10 space-y-8">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-4">
              <span className="text-primary font-mono text-[13px] font-semibold">
                {step.n}
              </span>
              <div>
                <h2 className="text-[16px] font-semibold">{step.title}</h2>
                <p className="text-ink-2 mt-1 text-[14px] leading-relaxed">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-12">
          <Button variant="primary" size="lg" asChild>
            <Link href="/sign-in">Start free</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
