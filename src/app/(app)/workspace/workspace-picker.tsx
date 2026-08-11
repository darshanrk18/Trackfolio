"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export function WorkspacePicker() {
  const trpc = useTRPC();
  const router = useRouter();
  const list = useQuery(trpc.applications.list.queryOptions({ limit: 50 }));

  React.useEffect(() => {
    if (list.data?.[0] && list.data.length === 1) {
      router.replace(`/applications/${list.data[0].id}`);
    }
  }, [list.data, router]);

  if (list.isPending) return <Skeleton className="h-40" />;
  if (list.error) return <ErrorState onRetry={() => void list.refetch()} />;
  if (!list.data?.length) {
    return (
      <>
        <PageHeader
          eyebrow="One company, everything together"
          title="Application Workspace"
        />
        <EmptyState
          title="Add an application first"
          action={
            <Button variant="primary" size="sm" asChild>
              <Link href="/applications">Go to applications</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="One company, everything together"
        title="Application Workspace"
        description="Open an application to keep the JD, submitted documents, contacts and timeline in one place."
      />
      <ul className="space-y-2">
        {list.data.map((app) => (
          <li key={app.id}>
            <Link
              href={`/applications/${app.id}`}
              className="border-line hover:border-line-2 bg-surface flex items-center justify-between rounded-[8px] border px-4 py-3"
            >
              <span className="block text-[13.5px] font-semibold">
                {app.company} {app.role ? `· ${app.role}` : ""}
              </span>
              <StatusPill status={app.status} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
