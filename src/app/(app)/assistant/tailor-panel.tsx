"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, GitBranch } from "lucide-react";
import { useTRPC } from "@/trpc/react";
import { DiffSummary, DiffView } from "@/components/app/diff-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/toggles";
import { diffLines } from "@/lib/diff";
import { applyResumeEdits } from "@/lib/apply-edits";
import { setResumeSourceId } from "@/lib/resume-source";

interface TailorPanelResult {
  edits: Array<{
    section: string;
    original: string;
    revised: string;
    reason: string;
  }>;
  refusals: string[];
}

export function TailorPanel({
  resume,
  company,
  role,
  sourceBranchId,
  sourceIsMaster,
  result,
}: {
  resume: string;
  company: string;
  role: string;
  sourceBranchId: string | null;
  sourceIsMaster: boolean;
  result: TailorPanelResult;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const editKey = result.edits.map((edit) => edit.original).join("\0");
  const [skippedState, setSkippedState] = React.useState({
    key: editKey,
    skipped: new Set<number>(),
  });
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  if (skippedState.key !== editKey) {
    setSkippedState({ key: editKey, skipped: new Set() });
    setCreatedId(null);
  }
  const skipped = skippedState.skipped;

  const selected = React.useMemo(() => {
    const next = new Set<number>();
    result.edits.forEach((_, index) => {
      if (!skipped.has(index)) next.add(index);
    });
    return next;
  }, [result.edits, skipped]);

  const preview = React.useMemo(
    () => applyResumeEdits(resume, result.edits, selected),
    [resume, result.edits, selected],
  );
  const diff = React.useMemo(
    () => diffLines(resume, preview.source),
    [resume, preview.source],
  );

  const locatable = preview.results.filter((row) => row.status !== "missing").length;
  const willApply = preview.applied;

  const saveDraft = useMutation(
    trpc.documents.saveDraft.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries(trpc.documents.pathFilter());
        toast.success("Saved tailored LaTeX onto this branch. Master is unchanged.");
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const createBranch = useMutation(
    trpc.documents.createBranch.mutationOptions({
      onSuccess: async (created) => {
        setCreatedId(created.id);
        setResumeSourceId(created.id);
        await qc.invalidateQueries(trpc.documents.pathFilter());
        toast.success(`Created branch “${created.name}”. Master is unchanged.`);
        router.push(`/resume?branch=${created.id}`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const toggle = (index: number, missing: boolean) => {
    if (missing) return;
    setSkippedState((prev) => {
      const next = new Set(prev.skipped);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { key: prev.key, skipped: next };
    });
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(preview.source);
      toast.success("Copied tailored LaTeX");
    } catch {
      toast.error("Could not copy to the clipboard.");
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <p className="text-ink-2 text-[12.5px]">
        {willApply} of {result.edits.length} selected edits locate in the source
        {preview.missing > 0 ? ` · ${preview.missing} could not be found` : ""}.
        Applied onto a new branch — master stays protected.
      </p>

      {result.edits.map((edit, i) => {
        const status = preview.results[i]?.status ?? "missing";
        const missing = status === "missing";
        const checked = !missing && !skipped.has(i);
        return (
          <Card key={`${edit.section}-${i}`} accent={missing ? "warn" : "none"}>
            <CardHeader>
              <label className="flex min-w-0 flex-1 items-start gap-2.5">
                <Checkbox
                  className="mt-0.5"
                  checked={checked}
                  disabled={missing}
                  onCheckedChange={() => toggle(i, missing)}
                  aria-label={`Apply edit in ${edit.section}`}
                />
                <CardTitle className="pt-0">{edit.section}</CardTitle>
              </label>
              {missing ? (
                <span className="text-warn font-mono text-[10.5px] uppercase">
                  Not in source
                </span>
              ) : null}
              {status === "overlap" ? (
                <span className="text-warn font-mono text-[10.5px] uppercase">
                  Overlaps another edit
                </span>
              ) : null}
            </CardHeader>
            <CardContent className="text-[13px]">
              <p className="text-bad font-mono text-[12px] line-through">{edit.original}</p>
              <p className="text-ok mt-1 font-mono text-[12px]">{edit.revised}</p>
              <p className="text-ink-2 mt-1 text-[12.5px]">{edit.reason}</p>
            </CardContent>
          </Card>
        );
      })}

      {result.refusals.length > 0 && (
        <div className="bg-warn-soft rounded-[8px] px-3 py-2 text-[12.5px]">
          {result.refusals.map((refusal) => (
            <p key={refusal}>{refusal}</p>
          ))}
        </div>
      )}

      {willApply > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">LaTeX preview</p>
            <DiffSummary stats={diff.stats} />
          </div>
          <DiffView ops={diff.ops} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          loading={createBranch.isPending}
          disabled={willApply === 0}
          onClick={() =>
            createBranch.mutate({
              kind: "resume",
              fromBranchId: sourceBranchId ?? undefined,
              company: company.trim() || undefined,
              role: role.trim() || undefined,
              name:
                company.trim() || role.trim() ? undefined : "Tailored draft",
              content: preview.source,
            })
          }
        >
          <GitBranch className="size-3.5" />
          Apply to a new branch
        </Button>
        {!sourceIsMaster && sourceBranchId ? (
          <Button
            variant="secondary"
            loading={saveDraft.isPending}
            disabled={willApply === 0}
            onClick={() =>
              saveDraft.mutate({
                branchId: sourceBranchId,
                content: preview.source,
              })
            }
          >
            Save onto this branch
          </Button>
        ) : null}
        <Button variant="secondary" disabled={willApply === 0} onClick={() => void copySource()}>
          <Copy className="size-3.5" />
          Copy LaTeX
        </Button>
        {createdId && (
          <Button variant="ghost" asChild>
            <Link href={`/resume?branch=${createdId}`}>Open in Resume Lab</Link>
          </Button>
        )}
      </div>
      {locatable === 0 && result.edits.length > 0 && (
        <p className="text-warn text-[12.5px]">
          None of the proposed spans were found in the LaTeX source, so nothing
          was applied. Re-run tailoring, or paste a matching span from Resume Lab.
        </p>
      )}
    </div>
  );
}
