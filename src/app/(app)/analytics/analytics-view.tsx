"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { HubTabs, INSIGHT_TABS } from "@/components/app/hub-tabs";
import { Funnel } from "@/components/app/funnel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton, StatCard } from "@/components/ui/feedback";
import type { ConversionRow } from "@/lib/insights/analytics";

function BarRows({ rows }: { rows: ConversionRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.interviewRate));
  return (
    <div>
      {rows.map((row) => (
        <div key={row.key} className="mb-2">
          <div className="grid grid-cols-[125px_1fr_48px] items-center gap-2">
            <div className="truncate text-[12px]" title={row.key}>
              {row.key}
            </div>
            <div className="bg-sunken h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${(row.interviewRate / max) * 100}%` }}
              />
            </div>
            <div className="text-ink-3 text-right font-mono text-[10px] tabular-nums">
              {row.interviewRate}%
            </div>
          </div>
          <p className="text-ink-3 mt-[-2px] ml-[133px] text-[10px]">
            {row.interviews}/{row.apps} interviews
            {row.smallSample ? " · small sample" : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsView() {
  const trpc = useTRPC();
  const analytics = useQuery(trpc.insights.analytics.queryOptions());

  if (analytics.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px]" />
        ))}
      </div>
    );
  }
  if (analytics.error || !analytics.data) {
    return <ErrorState onRetry={() => void analytics.refetch()} />;
  }

  const { summary, byProfile, bySource, insight } = analytics.data;

  return (
    <>
      <HubTabs items={INSIGHT_TABS} />
      <PageHeader
        eyebrow="Learn what actually converts"
        title="Search Analytics"
        description="Measure outcomes by resume profile, application source, and funnel stage. Small samples are labeled so you do not overfit your strategy."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={summary.applications} />
        <StatCard label="Active" value={summary.active} />
        <StatCard label="Interview rate" value={`${summary.interviewRate}%`} tone="primary" />
        <StatCard label="Offers" value={summary.offers} tone="ok" />
      </div>
      <Card className="mb-3">
        <CardHeader>
          <CardTitle>Funnel conversion</CardTitle>
        </CardHeader>
        <CardContent>
          <Funnel
            smallSample={summary.applications < 3}
            stages={[
              { label: "Applied", count: summary.applications, color: "var(--ink-3)" },
              { label: "Interview", count: summary.interviews, color: "var(--primary)" },
              { label: "Offer", count: summary.offers, color: "var(--ok)" },
            ]}
          />
        </CardContent>
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Interview conversion by resume profile</CardTitle>
          </CardHeader>
          <CardContent>
            {byProfile.length ? (
              <BarRows rows={byProfile} />
            ) : (
              <EmptyState title="Apply with saved resume versions to unlock this." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Interview conversion by source</CardTitle>
          </CardHeader>
          <CardContent>
            {bySource.length ? (
              <BarRows rows={bySource} />
            ) : (
              <EmptyState title="Add sources like Referral, LinkedIn, Handshake, Company site." />
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Strategy insight</CardTitle>
        </CardHeader>
        <CardContent>
          {insight ? (
            <>
              <p className="text-[13.5px]">
                <strong>{insight.key}</strong> currently has the strongest interview
                conversion among profiles with at least 3 applications:{" "}
                <strong>{insight.interviewRate}%</strong> ({insight.interviews}/
                {insight.apps}).
              </p>
              <p className="text-ink-2 mt-1.5 text-[12.5px]">
                Use this as directional evidence, not proof. Role mix and company
                quality can confound small samples.
              </p>
            </>
          ) : (
            <p className="text-ink-2 text-[13px]">
              Once a resume profile has at least 3 applications, Trackfolio will
              surface directional conversion insights here.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
