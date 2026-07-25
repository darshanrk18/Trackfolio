"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";

export function SignInForm({
  available,
  callbackUrl,
}: {
  available: { github: boolean; google: boolean; email: boolean };
  callbackUrl: string;
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);

  const oauth = (provider: "github" | "google") => {
    setPending(provider);
    void signIn(provider, { callbackUrl });
  };

  const onEmailSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setPending("email");
    void signIn("resend", { email: trimmed, callbackUrl });
  };

  const hasOAuth = available.github || available.google;

  return (
    <div className="mt-7 space-y-3">
      {available.github && (
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          loading={pending === "github"}
          loadingText="Redirecting…"
          disabled={pending !== null}
          onClick={() => oauth("github")}
        >
          <GitHubIcon />
          Continue with GitHub
        </Button>
      )}

      {available.google && (
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          loading={pending === "google"}
          loadingText="Redirecting…"
          disabled={pending !== null}
          onClick={() => oauth("google")}
        >
          <GoogleIcon />
          Continue with Google
        </Button>
      )}

      {hasOAuth && available.email && (
        <div className="flex items-center gap-3 py-1">
          <Separator className="flex-1" />
          <span className="text-ink-3 font-mono text-[10.5px] tracking-wider uppercase">
            or
          </span>
          <Separator className="flex-1" />
        </div>
      )}

      {available.email && (
        <form onSubmit={onEmailSubmit} className="space-y-2.5">
          <Field label="Email address" htmlFor="signin-email" error={emailError ?? undefined}>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending !== null}
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={pending === "email"}
            loadingText="Sending link…"
            disabled={pending !== null}
          >
            <Mail className="size-4" />
            Email me a sign-in link
          </Button>
        </form>
      )}
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}
