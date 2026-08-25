"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadBlob } from "@/lib/utils";

export function DataView() {
  const trpc = useTRPC();
  const [status, setStatus] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const csv = useQuery({
    ...trpc.data.exportApplicationsCsv.queryOptions(),
    enabled: false,
  });
  const backup = useMutation(
    trpc.data.exportBackup.mutationOptions({
      onSuccess: (payload) => {
        downloadBlob(
          JSON.stringify(payload, null, 2),
          `trackfolio-backup-${new Date().toISOString().slice(0, 10)}.json`,
          "application/json",
        );
        toast.success("Backup downloaded");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const restore = useMutation(
    trpc.data.importBackup.mutationOptions({
      onSuccess: (res) => {
        setStatus(
          `Restored ${res.restored.applications} applications, ${res.restored.versions} versions.`,
        );
        toast.success("Backup restored");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const reset = useMutation(
    trpc.data.resetContent.mutationOptions({
      onSuccess: () => toast.success("All search data erased"),
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <>
      <PageHeader
        title="Backup & data"
        description="Export a portable copy of everything. Restore replaces the current workspace. Your data stays yours."
      />

      <Card className="mb-3">
        <CardHeader>
          <CardTitle>Export everything</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-ink-2 mb-2.5 text-[13px]">
            One JSON file: all versions, applications, contacts, watchlist, and
            archived postings.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              loading={backup.isPending}
              onClick={() => backup.mutate()}
            >
              Download backup (.json)
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const result = await csv.refetch();
                if (result.data) {
                  downloadBlob(result.data.csv, "applications.csv", "text/csv");
                }
              }}
            >
              Applications as CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardHeader>
          <CardTitle>Restore from backup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-ink-2 mb-2.5 text-[13px]">
            Replaces everything currently in this account with the file’s contents.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="text-[13px]"
            />
            <Button
              variant="secondary"
              loading={restore.isPending}
              onClick={async () => {
                const file = fileRef.current?.files?.[0];
                if (!file) {
                  toast.error("Choose a backup file first");
                  return;
                }
                const text = await file.text();
                restore.mutate({ payload: JSON.parse(text) as unknown });
              }}
            >
              Restore
            </Button>
          </div>
          {status && <p className="text-ok mt-2 font-mono text-[12px]">{status}</p>}
        </CardContent>
      </Card>

      <Card accent="bad">
        <CardHeader>
          <CardTitle>Reset all data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-ink-2 mb-2.5 text-[13px]">
            Clears every version, application, and contact. Export a backup first.
            The account itself stays signed in.
          </p>
          <Button
            variant="danger"
            loading={reset.isPending}
            onClick={() => {
              if (confirm("Erase everything in this account? This cannot be undone.")) {
                reset.mutate({ confirmation: "RESET" });
              }
            }}
          >
            Erase everything
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
