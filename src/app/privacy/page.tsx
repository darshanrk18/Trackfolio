import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Trackfolio handles your job-search data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-line border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-5">
          <Logo href="/" />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-eyebrow mb-2">Legal</p>
        <h1 className="font-display text-[32px] font-bold tracking-[-0.03em]">
          Privacy
        </h1>
        <div className="text-ink-2 mt-6 max-w-[68ch] space-y-4 text-[14.5px] leading-relaxed">
          <p>
            Trackfolio stores the documents, applications, contacts and analyses
            you create so the product can do its job: remember which resume went
            to whom.
          </p>
          <p>
            Your data is scoped to your account. Other users cannot read it.
            Compilations are cached by content hash so an unchanged document is
            never re-sent to the LaTeX compiler.
          </p>
          <p>
            AI features, when enabled, send the relevant resume excerpt and job
            description to the configured model provider. Prompts are written so
            the model must not invent employers, technologies or metrics. Every
            call is audited.
          </p>
          <p>
            You can export a full JSON backup at any time from Backup &amp; Data,
            and you can permanently delete the account from Settings. Deletion
            removes every content row in a single transaction.
          </p>
          <p>
            Authentication is handled by Auth.js with GitHub, Google or email
            magic links, depending on which credentials this deployment has
            configured. Session cookies are HTTP-only.
          </p>
          <p>
            Questions: open an issue on the project repository, or email the
            operator of this deployment.
          </p>
        </div>
        <Link href="/" className="text-ink-3 mt-10 inline-block text-[13px] hover:text-[var(--ink)]">
          ← Home
        </Link>
      </main>
    </div>
  );
}
