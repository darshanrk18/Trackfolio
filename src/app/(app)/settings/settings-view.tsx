"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import type { TexEngine } from "@/server/db/schema";

export function SettingsView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { setTheme } = useTheme();
  const profile = useQuery(trpc.profile.get.queryOptions());
  const [confirm, setConfirm] = React.useState("");

  const update = useMutation(
    trpc.profile.update.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries(trpc.profile.pathFilter());
        toast.success("Settings saved");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const destroy = useMutation(
    trpc.profile.deleteAccount.mutationOptions({
      onSuccess: () => void signOut({ callbackUrl: "/" }),
      onError: (err) => toast.error(err.message),
    }),
  );

  if (profile.isPending) return <Skeleton className="h-64" />;
  if (profile.error || !profile.data) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }

  const p = profile.data;
  const save = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Profile, theme, compile defaults, and account controls."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            <Field label="Full name">
              <Input
                defaultValue={p.fullName ?? p.name ?? ""}
                onBlur={(e) => save({ fullName: e.target.value })}
              />
            </Field>
            <Field label="Headline">
              <Input
                defaultValue={p.headline ?? ""}
                placeholder="Software engineer"
                onBlur={(e) => save({ headline: e.target.value })}
              />
            </Field>
            <Field label="Location">
              <Input
                defaultValue={p.location ?? ""}
                onBlur={(e) => save({ location: e.target.value })}
              />
            </Field>
            <Field label="LinkedIn">
              <Input
                defaultValue={p.linkedinUrl ?? ""}
                onBlur={(e) => save({ linkedinUrl: e.target.value })}
              />
            </Field>
            <Field label="GitHub">
              <Input
                defaultValue={p.githubUrl ?? ""}
                onBlur={(e) => save({ githubUrl: e.target.value })}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            <Field label="Theme">
              <NativeSelect
                defaultValue={p.theme}
                onChange={(e) => {
                  const theme = e.target.value as "light" | "dark" | "system";
                  setTheme(theme);
                  save({ theme });
                }}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </NativeSelect>
            </Field>
            <Field label="Stale after (days)">
              <Input
                type="number"
                min={1}
                max={120}
                defaultValue={p.staleAfterDays}
                onBlur={(e) => save({ staleAfterDays: Number(e.target.value) })}
              />
            </Field>
            <Field label="LaTeX engine">
              <NativeSelect
                defaultValue={p.defaultTexEngine}
                onChange={(e) =>
                  save({ defaultTexEngine: e.target.value as TexEngine })
                }
              >
                <option value="pdflatex">pdfLaTeX</option>
                <option value="xelatex">XeLaTeX</option>
                <option value="lualatex">LuaLaTeX</option>
              </NativeSelect>
            </Field>
            <label className="text-ink-2 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                defaultChecked={p.autoCompile}
                onChange={(e) => save({ autoCompile: e.target.checked })}
              />
              Auto-compile after edits
            </label>
            <label className="text-ink-2 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                defaultChecked={p.digestEnabled}
                onChange={(e) => save({ digestEnabled: e.target.checked })}
              />
              Weekly digest email
            </label>
          </CardContent>
        </Card>
      </div>

      <Card accent="bad" className="mt-4">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-ink-2 mb-2 text-[13px]">
            Permanently removes every document, application and contact, then
            closes the account. Type <strong>{p.email}</strong> to confirm.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={p.email}
              className="max-w-sm"
            />
            <Button
              variant="danger-solid"
              disabled={confirm !== p.email}
              loading={destroy.isPending}
              onClick={() => destroy.mutate({ confirmation: confirm })}
            >
              Delete my account
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
