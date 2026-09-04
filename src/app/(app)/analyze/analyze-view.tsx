"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { HealthPanel } from "@/components/app/health-panel";
import { FitHeatmap } from "@/components/app/fit-heatmap";
import { HubTabs, INSIGHT_TABS } from "@/components/app/hub-tabs";
import { ResumeSourceSelect, useResumeSource } from "@/components/app/resume-source-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, ProgressRing, Skeleton } from "@/components/ui/feedback";

export function AnalyzeView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { branch, workspace } = useResumeSource();
  const [jd, setJd] = React.useState("");
  const [submittedJd, setSubmittedJd] = React.useState("");

  const health = useQuery({
    ...trpc.analysis.health.queryOptions(
      branch?.id ? { branchId: branch.id } : {},
    ),
    enabled: Boolean(branch?.id),
  });
  const match = useQuery({
    ...trpc.analysis.jobMatch.queryOptions({
      jobDescription: submittedJd,
      ...(branch?.id ? { branchId: branch.id } : {}),
    }),
    enabled: submittedJd.trim().length > 0 && Boolean(branch?.id),
  });

  const addTerm = useMutation(
    trpc.documents.addWatchTerm.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries(trpc.analysis.pathFilter());
        toast.success("Added to watchlist");
      },
    }),
  );

  return (
    <>
      <HubTabs items={INSIGHT_TABS} />
      <PageHeader
        title="Analyze"
        description="Score the selected resume against best practices, and against a specific job description."
        actions={<ResumeSourceSelect />}
      />

      <h3 className="mb-2 text-[14.5px] font-semibold">Resume health</h3>
      <Card className="mb-6">
        <CardContent className="pt-4">
          {workspace.isPending || health.isPending ? (
            <Skeleton className="h-32" />
          ) : health.error ? (
            <ErrorState onRetry={() => void health.refetch()} />
          ) : health.data ? (
            <HealthPanel report={health.data} />
          ) : null}
        </CardContent>
      </Card>

      <h3 className="mb-1 text-[14.5px] font-semibold">Job description match</h3>
      <p className="text-ink-2 mb-3 text-[13px]">
        Paste a posting. Terms it emphasises are matched against the resume
        selected above.
      </p>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <div>
          <Textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job description here…"
            className="min-h-[220px]"
          />
          <div className="mt-2.5 flex gap-2">
            <Button variant="primary" onClick={() => setSubmittedJd(jd)}>
              Analyze match
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setJd("");
                setSubmittedJd("");
              }}
            >
              Clear
            </Button>
          </div>
        </div>
        <div>
          {!submittedJd.trim() ? (
            <EmptyState
              title="Paste a job description and click Analyze"
              description="Required terms carry more weight than preferred terms."
            />
          ) : match.isPending ? (
            <Skeleton className="h-64" />
          ) : match.error ? (
            <ErrorState description={match.error.message} onRetry={() => void match.refetch()} />
          ) : match.data ? (
            <div className="space-y-3">
              <Card>
                <CardContent className="flex items-center gap-5 pt-4">
                  <ProgressRing
                    value={match.data.score}
                    size={112}
                    thickness={9}
                    label={`${match.data.score}%`}
                    sublabel="ROLE FIT"
                  />
                  <p className="text-[13.5px]">
                    <strong>
                      {match.data.present.length}/{match.data.terms.length}
                    </strong>{" "}
                    detected requirements appear in the resume.
                    <span className="text-ink-2 mt-1 block text-[12.5px]">
                      Must-have coverage: {match.data.mustCoverage}%.
                    </span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-mono text-[11px] tracking-wide">
                    PRESENT VS MISSING
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FitHeatmap match={match.data} />
                </CardContent>
              </Card>
              {(["must", "preferred", "other"] as const).map((tier) => {
                const rows = match.data[tier];
                if (!rows.length) return null;
                const title =
                  tier === "must"
                    ? "MUST / REQUIRED"
                    : tier === "preferred"
                      ? "PREFERRED"
                      : "OTHER SIGNALS";
                return (
                  <Card key={tier}>
                    <CardHeader>
                      <CardTitle className="font-mono text-[11px] tracking-wide">
                        {title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {rows.map((term) => (
                        <div
                          key={term.term}
                          className="border-line flex items-start gap-2 border-b py-1.5 last:border-0"
                        >
                          <span
                            className={
                              term.present ? "text-ok w-4 font-bold" : "text-bad w-4 font-bold"
                            }
                          >
                            {term.present ? "✓" : "✕"}
                          </span>
                          <span className="flex-1 text-[12.5px]">{term.term}</span>
                          <span className="text-ink-3 font-mono text-[9px]">
                            {term.count}×
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
              <div className="bg-warn-soft border-l-[3px] border-[var(--warn)] rounded-[6px] px-3 py-2.5 text-[12px]">
                <strong>Truth guardrail:</strong>{" "}
                {match.data.missing.length
                  ? `${match.data.missing.length} detected term${match.data.missing.length === 1 ? " is" : "s are"} absent. Treat these as gaps — not instructions to add skills you cannot defend.`
                  : "No detected technical gaps in the extracted terms."}
              </div>
              {match.data.missing.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {match.data.missing.map((term) => (
                    <Chip
                      key={term.term}
                      tone="dashed"
                      onClick={() => addTerm.mutate({ term: term.term })}
                    >
                      + watch {term.term}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
