"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { Field, NativeSelect } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/feedback";
import {
  formatBranchOption,
  resumeSourceStore,
  setResumeSourceId,
} from "@/lib/resume-source";
import { cn } from "@/lib/utils";

export function useResumeSource() {
  const trpc = useTRPC();
  const workspace = useQuery(trpc.documents.workspace.queryOptions({ kind: "resume" }));
  const storedId = React.useSyncExternalStore(
    resumeSourceStore.subscribe,
    resumeSourceStore.getSnapshot,
    resumeSourceStore.getServerSnapshot,
  );

  const branches = workspace.data?.branches ?? [];
  const master = workspace.data?.master ?? null;
  const stored = storedId ? branches.find((b) => b.id === storedId) : undefined;
  const branch = stored ?? master ?? branches[0] ?? null;

  return {
    workspace,
    branches,
    master,
    branch,
    content: branch?.content ?? "",
    setBranchId: setResumeSourceId,
  };
}

export function ResumeSourceSelect({
  id = "resume-source",
  className,
}: {
  id?: string;
  className?: string;
}) {
  const { workspace, branches, branch, setBranchId } = useResumeSource();

  if (workspace.isPending) {
    return <Skeleton className={cn("h-9 w-full max-w-[280px]", className)} />;
  }
  if (!branch) return null;

  return (
    <Field
      label="Resume"
      htmlFor={id}
      className={cn("w-full max-w-[280px]", className)}
      hint={
        branch.isMaster
          ? "Master is the default. Tailoring writes a new branch."
          : `Working copy “${branch.name}”.`
      }
    >
      <NativeSelect
        id={id}
        value={branch.id}
        onChange={(e) => setBranchId(e.target.value)}
        aria-label="Resume"
      >
        {branches.map((item) => (
          <option key={item.id} value={item.id}>
            {formatBranchOption(item)}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}
