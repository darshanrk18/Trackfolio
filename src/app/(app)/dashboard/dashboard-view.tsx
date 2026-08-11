"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Zap } from "lucide-react";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { Funnel } from "@/components/app/funnel";
import { Timeline } from "@/components/app/timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, StatCard } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const trpc = useTRPC();
  const { data, isPending, error, refetch } = useQuery(
    trpc.insights.dashboard.queryOptions(),
  );

  if (isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Couldn't load the dashboard"
        onRetry={() => void refetch()}
      />
    );
  }

  const maxFunnel = Math.max(1, data.totals.applications);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Where your search stands right now. The queue updates as you log applications, save versions, and capture snapshots."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Applications"
          value={data.totals.applications}
          hint={`${data.totals.active} still active`}
        />
        <StatCard
          label="Reached interview"
          value={data.totals.interviews}
          tone={data.totals.interviews ? "primary" : "neutral"}
          hint={
            data.totals.applications
              ? `${Math.round((data.totals.interviews / maxFunnel) * 100)}% of applications`
              : "Log a submission to start the funnel"
          }
        />
        <StatCard
          label="Need follow-up"
          value={data.totals.stale}
          tone={data.totals.stale ? "warn" : "neutral"}
          hint="Quiet for two weeks or more"
        />
        <StatCard
          label="Resume health"
          value={data.health?.score ?? "—"}
          tone={
            !data.health
              ? "neutral"
              : data.health.score >= 75
                ? "ok"
                : data.health.score >= 50
                  ? "warn"
                  : "bad"
          }
          hint={
            data.health
              ? `${data.health.bulletCount} bullets · ${data.health.wordCount} words`
              : "Paste a resume in Resume Lab"
          }
        />
      </div>

      {data.totals.flaggedSnapshots > 0 && (
        <Card accent="bad" className="mb-6">
          <CardContent className="py-3.5">
            <p className="text-bad text-[13.5px] font-semibold">
              {data.totals.flaggedSnapshots} application
              {data.totals.flaggedSnapshots === 1 ? "" : "s"} went out without a
              frozen snapshot.
            </p>
            <p className="text-ink-2 mt-1 text-[12.5px]">
              Open the workspace and capture the exact resume that company received.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              {data.totals.applications === 0 ? (
                <EmptyState
                  title="No applications yet"
                  description="Log the first company you applied to. Trackfolio will keep the documents that went with it."
                  action={
                    <Button variant="primary" size="sm" asChild>
                      <Link href="/applications">Add an application</Link>
                    </Button>
                  }
                />
              ) : (
                <Funnel
                  stages={data.funnel.map((stage) => ({
                    label: stage.label,
                    count: stage.count,
                    color:
                      stage.status === "offer"
                        ? "var(--ok)"
                        : stage.status === "interview"
                          ? "var(--primary)"
                          : "var(--ink-3)",
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline
                items={data.activity.map((item) => ({
                  id: item.id,
                  label: item.label,
                  at: item.createdAt,
                }))}
                empty="Save a version or log an application to get started."
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Action queue</CardTitle>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/actions">
                All {data.actionCount} <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.actions.length === 0 ? (
              <EmptyState
                icon={<Zap />}
                title="Nothing urgent"
                description="Your queue is clean. When a follow-up is due or an interview lands this week, it will show up here."
              />
            ) : (
              <ul className="space-y-2">
                {data.actions.map((action) => (
                  <li key={action.id}>
                    <Link
                      href={action.href}
                      className={cn(
                        "border-line hover:border-line-2 block rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors",
                        action.kind === "urgent" &&
                          "shadow-[inset_3px_0_0_var(--bad)]",
                        action.kind === "soon" &&
                          "shadow-[inset_3px_0_0_var(--warn)]",
                        action.kind === "info" &&
                          "shadow-[inset_3px_0_0_var(--primary)]",
                      )}
                    >
                      <p className="text-[13px] font-semibold">{action.title}</p>
                      <p className="text-ink-3 mt-0.5 text-[11.5px]">
                        {action.meta}
                        {action.role ? ` · ${action.role}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
