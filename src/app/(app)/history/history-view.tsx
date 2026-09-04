"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { DOCUMENT_TABS, HubTabs } from "@/components/app/hub-tabs";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { downloadBlob, formatDateTime } from "@/lib/utils";
import type { DocumentKind } from "@/server/db/schema";

export function HistoryView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | DocumentKind>("all");

  const versions = useQuery(
    trpc.documents.listVersions.queryOptions({
      kind: filter === "all" ? undefined : filter,
      limit: 200,
    }),
  );
  const workspace = useQuery(trpc.documents.workspace.queryOptions({ kind: "resume" }));

  const restore = useMutation(
    trpc.documents.restoreVersion.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries(trpc.documents.pathFilter());
        toast.success("Restored into the active branch");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const remove = useMutation(
    trpc.documents.deleteVersion.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries(trpc.documents.pathFilter());
        toast.success("Version removed. Application snapshots are unaffected.");
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const items = (versions.data ?? []).filter((v) =>
    search.trim()
      ? (v.note || "").toLowerCase().includes(search.toLowerCase())
      : true,
  );

  return (
    <>
      <HubTabs items={DOCUMENT_TABS} />
      <PageHeader
        title="History"
        description="Every saved version, kept in full. Nothing saved here can silently disappear."
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="min-w-[190px]"
        />
        <NativeSelect
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
        >
          <option value="all">All documents</option>
          <option value="resume">Resume only</option>
          <option value="cover_letter">Cover letters only</option>
        </NativeSelect>
      </div>

      {versions.isPending ? (
        <Skeleton className="h-64" />
      ) : versions.error ? (
        <ErrorState onRetry={() => void versions.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No versions match." description="Save a version from Resume Lab or Cover Letters." />
      ) : (
        <div className="space-y-2">
          {items.map((v) => (
            <div
              key={v.id}
              className="border-line bg-surface rounded-[8px] border px-3.5 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[14px] font-medium">
                  <Badge tone="neutral" mono size="sm" className="mr-2">
                    {v.kind === "resume" ? "RESUME" : "COVER"}
                  </Badge>
                  {v.note || "(no note)"}
                </p>
                <span className="text-ink-3 shrink-0 font-mono text-[11px]">
                  {formatDateTime(v.createdAt)}
                </span>
              </div>
              <p className="text-ink-3 mt-1 font-mono text-[10.5px]">
                {v.branchName ? `${v.branchName} · ` : ""}v{v.revision}
                {v.stats ? ` · health ${v.stats.healthScore}` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!workspace.data?.master}
                  onClick={() =>
                    workspace.data?.master &&
                    restore.mutate({
                      versionId: v.id,
                      branchId: workspace.data.master.id,
                    })
                  }
                >
                  Restore to master
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadBlob(
                      v.content,
                      `${v.kind}-${v.revision}.${v.format === "latex" ? "tex" : "txt"}`,
                      "text/plain",
                    )
                  }
                >
                  Download
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm("Delete this version? Application snapshots stay intact.")) {
                      remove.mutate({ id: v.id });
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
