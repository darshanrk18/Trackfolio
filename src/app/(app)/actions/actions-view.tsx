"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Zap } from "lucide-react";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { ActionQueue } from "@/components/app/action-queue";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, StatCard } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

export function ActionsView() {
  const trpc = useTRPC();
  const queue = useQuery(trpc.insights.actionQueue.queryOptions());
  const dash = useQuery(trpc.insights.dashboard.queryOptions());

  return (
    <>
      <PageHeader
        eyebrow="Daily operating queue"
        title="Action Center"
        description="The highest-value things to do next: follow-ups, stale applications, upcoming interviews, and incomplete records."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void queue.refetch()}
            disabled={queue.isFetching}
          >
            <RefreshCw className={cn(queue.isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dash.isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))
        ) : (
          <>
            <StatCard label="Open actions" value={queue.data?.length ?? 0} />
            <StatCard
              label="Stale"
              value={dash.data?.totals.stale ?? 0}
              tone={dash.data?.totals.stale ? "warn" : "neutral"}
            />
            <StatCard
              label="Interviews"
              value={dash.data?.totals.interviews ?? 0}
              tone="primary"
            />
            <StatCard label="Active" value={dash.data?.totals.active ?? 0} />
          </>
        )}
      </div>

      {queue.isPending ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : queue.error ? (
        <ErrorState onRetry={() => void queue.refetch()} />
      ) : !queue.data?.length ? (
        <EmptyState
          icon={<Zap />}
          title="Nothing urgent. Your queue is clean."
          description="When a follow-up is due, an interview is this week, or a snapshot is missing, it will land here."
        />
      ) : (
        <ActionQueue items={queue.data} />
      )}
    </>
  );
}
