import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/server/auth";
import { features } from "@/env";
import { Logo } from "@/components/shell/logo";
import { ConsoleMock } from "@/components/app/console-mock";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Trackfolio.",
};

const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a different sign-in method. Use the provider you signed up with.",
  AccessDenied: "Access was denied by the provider.",
  Verification: "That sign-in link has expired or was already used.",
  Configuration:
    "Authentication is not configured on this deployment. Check the server environment variables.",
  Default: "Something went wrong signing you in. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");

  const params = await searchParams;
  const error = params.error ? (AUTH_ERRORS[params.error] ?? AUTH_ERRORS.Default) : null;

  const available = {
    github: features.githubAuth,
    google: features.googleAuth,
    email: features.email,
  };
  const anyProvider = available.github || available.google || available.email;

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo href="/" className="mb-10" />

          <h1 className="font-display text-[26px] font-bold tracking-[-0.02em]">
            Welcome back
          </h1>
          <p className="text-ink-2 mt-1.5 text-[14px]">
            Sign in to pick up your search where you left off.
          </p>

          {error && (
            <div
              role="alert"
              className="bg-bad-soft border-bad-border text-bad mt-5 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-[13px]"
            >
              {error}
            </div>
          )}

          {anyProvider ? (
            <SignInForm
              available={available}
              callbackUrl={params.callbackUrl ?? "/dashboard"}
            />
          ) : (
            <div className="bg-warn-soft border-warn-border text-ink mt-6 rounded-[var(--radius-md)] border px-4 py-3.5 text-[13px]">
              <p className="font-semibold">No sign-in provider is configured.</p>
              <p className="text-ink-2 mt-1.5">
                Set <code className="font-mono text-[12px]">AUTH_GITHUB_ID</code> /{" "}
                <code className="font-mono text-[12px]">AUTH_GITHUB_SECRET</code>,
                the Google equivalents, or{" "}
                <code className="font-mono text-[12px]">RESEND_API_KEY</code> for
                email links, then restart the server.
              </p>
            </div>
          )}

          <p className="text-ink-3 mt-8 text-[11.5px] leading-relaxed">
            By continuing you agree that Trackfolio stores the documents and
            application records you create. You can export or permanently delete
            all of it at any time from{" "}
            <span className="text-ink-2">Settings → Data</span>.
          </p>

          <Link
            href="/"
            className="text-ink-3 hover:text-ink mt-6 inline-block text-[12.5px] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>

      {/* Pitch side */}
      <div className="console-grid bg-surface border-line hidden flex-col justify-center border-l px-10 py-12 lg:flex">
        <div className="mx-auto w-full max-w-lg">
          <p className="text-eyebrow mb-3">Why Trackfolio</p>
          <h2 className="font-display text-[22px] leading-snug font-bold tracking-[-0.02em]">
            The resume you sent should never disappear.
          </h2>
          <p className="text-ink-2 mt-2 mb-6 text-[13.5px] leading-relaxed">
            Don&apos;t overwrite master. Freeze what you sent. Prepare from that.
            Don&apos;t invent skills.
          </p>
          <ConsoleMock />
        </div>
      </div>
    </div>
  );
}
