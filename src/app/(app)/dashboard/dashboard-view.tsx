"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, Zap } from "lucide-react";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { Funnel } from "@/components/app/funnel";
import { HealthRing } from "@/components/app/health-panel";
import { ActionQueue } from "@/components/app/action-queue";
import { Timeline } from "@/components/app/timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, StatCard } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/utils";

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
        eyebrow="Command center"
        title="Today"
        description="Search pulse, ranked next moves, and the interviews coming up. Open an application to work it in Pipeline."
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
              : "Paste a resume in Documents"
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

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ranked queue</CardTitle>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/actions">
                View all {data.actionCount} <ArrowRight className="size-3" />
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
              <ActionQueue items={data.actions} compact />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Health</CardTitle>
              <Button variant="ghost" size="xs" asChild>
                <Link href="/analyze">Fit</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.health ? (
                <HealthRing
                  score={data.health.score}
                  grade={data.health.grade}
                  issues={data.health.issues}
                />
              ) : (
                <EmptyState
                  title="No master resume yet"
                  description="Paste a resume in Documents to score health."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming interviews</CardTitle>
            </CardHeader>
            <CardContent>
              {data.upcoming.length === 0 ? (
                <p className="text-ink-3 flex items-center gap-2 text-[12.5px]">
                  <Calendar className="size-3.5" aria-hidden />
                  None scheduled in the next three weeks.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.upcoming.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/interview?application=${item.id}`}
                        className="border-line hover:border-line-2 block rounded-[var(--radius-md)] border px-3 py-2"
                      >
                        <p className="text-[13px] font-semibold">{item.company}</p>
                        <p className="text-ink-3 readout mt-0.5 text-[11px]">
                          {item.interviewOn ? formatDateTime(item.interviewOn) : "Date TBD"}
                          {item.frozen ? " · frozen" : " · not frozen"}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Conversion</CardTitle>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/analytics">Full analytics</Link>
            </Button>
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
                smallSample={data.smallSample}
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
    </>
  );
}
