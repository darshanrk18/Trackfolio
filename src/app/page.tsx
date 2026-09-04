import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Lock, Shield } from "lucide-react";
import { currentUser } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shell/logo";
import { Badge } from "@/components/ui/badge";
import { ConsoleMock } from "@/components/app/console-mock";

export default async function LandingPage() {
  // Signed-in visitors have no use for the pitch.
  if (await currentUser()) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line bg-bg/80 sticky top-0 z-40 border-b backdrop-blur-md">
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
        <section className="console-grid mx-auto max-w-6xl px-5 pt-16 pb-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Badge tone="primary" mono className="mb-5">
                Job Search OS
              </Badge>
              <h1 className="font-display max-w-xl text-[clamp(2.1rem,5vw,3.4rem)] leading-[1.05] font-bold tracking-[-0.03em]">
                Know exactly which resume
                <br />
                you sent to whom.
              </h1>
              <p className="text-ink-2 mt-5 max-w-xl text-[16px] leading-relaxed">
                Four promises, one console: don&apos;t overwrite master, freeze
                what you sent, prepare from that, and don&apos;t invent skills.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
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
            </div>
            <ConsoleMock />
          </div>
        </section>

        <section className="border-line bg-surface border-y">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <p className="text-eyebrow mb-6">The four promises</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {PROMISES.map((promise) => (
                <li
                  key={promise.title}
                  className="border-line rounded-[var(--radius-lg)] border px-4 py-4"
                >
                  <p className="text-[14px] font-semibold">{promise.title}</p>
                  <p className="text-ink-2 mt-1.5 text-[13px] leading-relaxed">
                    {promise.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14">
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
        </section>

        <section className="border-line bg-surface border-y">
          <div className="mx-auto max-w-3xl px-5 py-14 text-center">
            <Shield className="text-ok mx-auto mb-4 size-7" aria-hidden />
            <h2 className="font-display text-[24px] font-bold tracking-[-0.02em]">
              AI that refuses to lie on your behalf
            </h2>
            <p className="text-ink-2 mx-auto mt-3 max-w-2xl text-[14.5px] leading-relaxed">
              Gaps render as missing evidence, never as “add this fake bullet.”
              Every suggestion stays grounded in the resume you actually wrote.
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

const PROMISES = [
  {
    title: "Don't overwrite master",
    body: "A locked trunk plus a branch per company. Tailor freely. Master stays the canonical resume.",
  },
  {
    title: "Freeze what you sent",
    body: "Snapshots are copies, not file pointers. Deleting a version never rewrites what a company received.",
  },
  {
    title: "Prepare from that",
    body: "Interview prep uses the frozen snapshot and archived JD — not today's working copy.",
  },
  {
    title: "Don't invent skills",
    body: "Deterministic analysis first. AI reports gaps. Missing evidence stays empty on the heatmap.",
  },
] as const;
