"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Logo } from "@/components/shell/logo";

export function OnboardingView() {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useQuery(trpc.profile.get.queryOptions());
  const workspace = useQuery(trpc.documents.workspace.queryOptions({ kind: "resume" }));
  const [name, setName] = React.useState<string | null>(null);
  const [resume, setResume] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(0);
  const displayName = name ?? profile.data?.fullName ?? "";
  const displayResume = resume ?? workspace.data?.master?.content ?? "";

  React.useEffect(() => {
    if (profile.data?.onboarded) router.replace("/dashboard");
  }, [profile.data?.onboarded, router]);

  const update = useMutation(trpc.profile.update.mutationOptions());
  const saveDraft = useMutation(trpc.documents.saveDraft.mutationOptions());
  const finish = useMutation(
    trpc.profile.completeOnboarding.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries(trpc.profile.pathFilter());
        router.replace("/dashboard");
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const next = async () => {
    if (step === 0) {
      if (displayName.trim()) await update.mutateAsync({ fullName: displayName.trim() });
      setStep(1);
      return;
    }
    const masterId = workspace.data?.master?.id;
    if (masterId && displayResume.trim()) {
      await saveDraft.mutateAsync({ branchId: masterId, content: displayResume });
    }
    finish.mutate();
  };

  return (
    <div className="mx-auto max-w-xl py-10">
      <Logo className="mb-8" />
      <p className="text-eyebrow mb-2">Step {step + 1} of 2</p>
      <h1 className="font-display mb-2 text-[26px] font-bold tracking-[-0.02em]">
        {step === 0 ? "What should we call you?" : "Paste your resume"}
      </h1>
      <p className="text-ink-2 mb-6 text-[14px]">
        {step === 0
          ? "Used on exports and as the default identity on documents."
          : "LaTeX is preferred. You can keep editing in Resume Lab after this."}
      </p>
      {step === 0 ? (
        <Field label="Full name" htmlFor="ob-name">
          <Input
            id="ob-name"
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
          />
        </Field>
      ) : (
        <Textarea
          mono
          className="min-h-[280px]"
          value={displayResume}
          onChange={(e) => setResume(e.target.value)}
          placeholder="\documentclass{article}…"
        />
      )}
      <div className="mt-6 flex gap-2">
        {step === 1 && (
          <Button variant="secondary" onClick={() => setStep(0)}>
            Back
          </Button>
        )}
        <Button variant="primary" onClick={() => void next()} loading={finish.isPending}>
          {step === 0 ? "Continue" : "Enter Trackfolio"}
        </Button>
        <Button variant="ghost" onClick={() => finish.mutate()}>
          Skip
        </Button>
      </div>
    </div>
  );
}
