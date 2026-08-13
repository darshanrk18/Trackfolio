"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { DiffSummary, DiffView } from "@/components/app/diff-view";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";

export function CompareView() {
  const trpc = useTRPC();
  const versions = useQuery(trpc.documents.listVersions.queryOptions({ limit: 200 }));
  const [left, setLeft] = React.useState("");
  const [right, setRight] = React.useState("");
  const [mode, setMode] = React.useState<"line" | "word">("line");
  const [run, setRun] = React.useState(false);

  const versionList = versions.data ?? [];
  const leftId = left || versionList[0]?.id || "";
  const rightId = right || versionList[1]?.id || versionList[0]?.id || "";

  const diff = useQuery({
    ...trpc.analysis.diff.queryOptions({
      leftVersionId: leftId || undefined,
      rightVersionId: rightId || undefined,
      granularity: mode,
    }),
    enabled: run && Boolean(leftId && rightId),
  });

  return (
    <>
      <PageHeader
        title="Compare"
        description="Check any draft against a saved version before sending it anywhere."
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <NativeSelect value={leftId} onChange={(e) => setLeft(e.target.value)} className="max-w-[290px]">
          {versionList.map((v) => (
            <option key={v.id} value={v.id}>
              [{v.kind === "resume" ? "Resume" : "Cover"}] {v.note || "untitled"}
            </option>
          ))}
        </NativeSelect>
        <span className="text-ink-3 font-mono">→</span>
        <NativeSelect value={rightId} onChange={(e) => setRight(e.target.value)} className="max-w-[290px]">
          {versionList.map((v) => (
            <option key={v.id} value={v.id}>
              [{v.kind === "resume" ? "Resume" : "Cover"}] {v.note || "untitled"}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={mode} onChange={(e) => setMode(e.target.value as "line" | "word")}>
          <option value="line">Line diff</option>
          <option value="word">Word diff</option>
        </NativeSelect>
        <Button variant="primary" onClick={() => setRun(true)} disabled={!leftId || !rightId}>
          Compare
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLeft(rightId);
            setRight(leftId);
          }}
        >
          Swap
        </Button>
      </div>
      {diff.isPending && run ? (
        <Skeleton className="h-64" />
      ) : diff.error ? (
        <ErrorState description={diff.error.message} onRetry={() => void diff.refetch()} />
      ) : diff.data ? (
        <>
          <div className="mb-2">
            <DiffSummary stats={diff.data.stats} />
          </div>
          <DiffView ops={diff.data.ops} granularity={diff.data.granularity} />
        </>
      ) : (
        <EmptyState title="Pick two versions and compare." />
      )}
    </>
  );
}
