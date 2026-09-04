"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { DOCUMENT_TABS, HubTabs } from "@/components/app/hub-tabs";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { debounce, downloadBlob } from "@/lib/utils";

export function CoverLettersView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const workspace = useQuery(
    trpc.documents.workspace.queryOptions({ kind: "cover_letter" }),
  );

  const [branchId, setBranchId] = React.useState<string | null>(null);
  const [content, setContent] = React.useState("");
  const [note, setNote] = React.useState("");
  const [hint, setHint] = React.useState<string | null>(null);

  const initial = workspace.data?.master ?? workspace.data?.branches[0];
  const resolvedId = branchId ?? initial?.id ?? null;
  const displayContent = branchId === null && initial ? initial.content : content;

  const saveDraft = useMutation(trpc.documents.saveDraft.mutationOptions());
  const persistDraft = React.useEffectEvent((id: string, next: string) => {
    saveDraft.mutate(
      { branchId: id, content: next },
      {
        onSuccess: (res) =>
          setHint(
            `Draft saved ${res.savedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
          ),
      },
    );
  });

  const [autosave] = React.useState(() =>
    debounce((id: string, next: string) => persistDraft(id, next), 900),
  );
  React.useEffect(() => () => autosave.cancel(), [autosave]);

  const commit = useMutation(
    trpc.documents.commitVersion.mutationOptions({
      onSuccess: (version) => {
        void qc.invalidateQueries(trpc.documents.pathFilter());
        setNote("");
        toast.success(`Saved ${version.note}`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  if (workspace.isPending) return <Skeleton className="h-[420px]" />;
  if (workspace.error) return <ErrorState onRetry={() => void workspace.refetch()} />;

  return (
    <>
      <HubTabs items={DOCUMENT_TABS} />
      <PageHeader
        title="Cover Letters"
        description="Same versioning habit as the resume — pull a specific one per application."
        actions={hint && <span className="text-ink-3 font-mono text-[11px]">{hint}</span>}
      />
      <Textarea
        className="min-h-[360px] text-[14px] leading-relaxed"
        placeholder="Draft your cover letter here…"
        value={displayContent}
        onChange={(e) => {
          const next = e.target.value;
          if (branchId === null && initial) setBranchId(initial.id);
          setContent(next);
          const id = branchId ?? initial?.id;
          if (id) autosave(id, next);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Label (e.g. tailored for Stripe)"
            className="w-[245px]"
          />
          <Button
            variant="primary"
            disabled={!resolvedId}
            loading={commit.isPending}
            onClick={() =>
              resolvedId &&
              commit.mutate({
                branchId: resolvedId,
                note: note || undefined,
                content: displayContent,
              })
            }
          >
            Save as version
          </Button>
          <Button
            variant="secondary"
            disabled={!resolvedId}
            onClick={() =>
              resolvedId && saveDraft.mutate({ branchId: resolvedId, content: displayContent })
            }
          >
            Save draft
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(displayContent);
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadBlob(displayContent, "cover-letter.txt", "text/plain")}
          >
            Export .txt
          </Button>
        </div>
      </div>
      <p className="text-ink-3 mt-2 font-mono text-[11.5px]">
        {displayContent.trim()
          ? `${displayContent.trim().split(/\s+/).length} words`
          : "Empty draft"}
      </p>
    </>
  );
}
