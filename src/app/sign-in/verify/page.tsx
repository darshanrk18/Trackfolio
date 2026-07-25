import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { Mail } from "lucide-react";

export const metadata: Metadata = { title: "Check your email" };

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo href="/" className="mb-8" />
      <span className="bg-primary-soft text-primary-ink mb-4 flex size-12 items-center justify-center rounded-full">
        <Mail className="size-5" />
      </span>
      <h1 className="font-display text-[24px] font-bold tracking-[-0.02em]">
        Check your inbox
      </h1>
      <p className="text-ink-2 mt-2 max-w-[42ch] text-[14px] leading-relaxed">
        We sent a sign-in link. It expires shortly and can only be used once.
      </p>
      <Link href="/sign-in" className="text-ink-3 mt-8 text-[13px] hover:text-[var(--ink)]">
        ← Back to sign in
      </Link>
    </div>
  );
}
