"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, Textarea, Input } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { extractRequirements, matchAgainstResume } from "@/lib/analysis";
import { debounce } from "@/lib/utils";

export function InterviewView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const search = useSearchParams();
  const preset = search.get("application") ?? search.get("id");
  const list = useQuery(trpc.applications.list.queryOptions({}));
  const [pickedId, setPickedId] = React.useState<string | null>(null);
  const id = pickedId ?? preset ?? list.data?.[0]?.id ?? "";

  const detail = useQuery({
    ...trpc.applications.byId.queryOptions({ id }),
    enabled: Boolean(id),
  });
  const aiEnabled = useQuery(trpc.ai.enabled.queryOptions());

  const save = useMutation(
    trpc.applications.saveInterviewPrep.mutationOptions({
      onSuccess: () => toast.success("Interview prep saved"),
      onError: (err) => toast.error(err.message),
    }),
  );
  const updateApp = useMutation(
    trpc.applications.update.mutationOptions({
      onSuccess: () => void qc.invalidateQueries(trpc.applications.pathFilter()),
      onError: (err) => toast.error(err.message),
    }),
  );
  const generate = useMutation(
    trpc.ai.generateInterviewQuestions.mutationOptions({
      onSuccess: (result) => {
        if (!id) return;
        save.mutate({
          id,
          prep: {
            generated: result.questions.map((q, i) => ({
              id: String(i),
              question: q.question,
              category: q.category,
              rationale: q.rationale,
            })),
          },
        });
        void qc.invalidateQueries(trpc.applications.pathFilter());
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const a = detail.data;
  const prep = a?.interviewPrep ?? {};
  const resume = a?.resumeSnapshot ?? "";
  const jd = a?.jobDescription ?? "";
  const topics = React.useMemo(() => {
    if (!jd || !resume) return [];
    return matchAgainstResume(extractRequirements(jd), resume)
      .present.slice(0, 18)
      .map((t) => t.term);
  }, [jd, resume]);

  const persistPrep = React.useEffectEvent(
    (applicationId: string, field: string, value: string) => {
      save.mutate({ id: applicationId, prep: { [field]: value } });
    },
  );
  const [autosave] = React.useState(() =>
    debounce((applicationId: string, field: string, value: string) => {
      persistPrep(applicationId, field, value);
    }, 800),
  );
  React.useEffect(() => () => autosave.cancel(), [autosave]);

  if (list.isPending) return <Skeleton className="h-64" />;
  if (!list.data?.length) {
    return (
      <>
        <PageHeader title="Interview Prep" />
        <EmptyState
          title="No application available for prep."
          description="Interview prep starts from a frozen snapshot on a company workspace — not from today's master resume."
          action={
            <Button variant="primary" size="sm" asChild>
              <Link href="/applications">Open pipeline</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Context-aware preparation"
        title="Interview Prep"
        description="Prepare from the JD and the exact resume that the company received — not from whatever your current master looks like now."
        actions={
          <Button
            variant="primary"
            size="sm"
            loading={save.isPending}
            onClick={() => toast.success("Prep autosaves as you type")}
          >
            Save prep
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <NativeSelect
          value={id}
          onChange={(e) => setPickedId(e.target.value)}
          className="min-w-[300px]"
        >
          {list.data.map((row) => (
            <option key={row.id} value={row.id}>
              {row.company} · {row.role || "Role"}
            </option>
          ))}
        </NativeSelect>
        {a && (
          <Input
            type="datetime-local"
            defaultValue={
              a.interviewOn ? new Date(a.interviewOn).toISOString().slice(0, 16) : ""
            }
            onBlur={(e) => {
              if (!id) return;
              updateApp.mutate({
                id,
                interviewOn: e.target.value ? new Date(e.target.value) : null,
              });
            }}
          />
        )}
      </div>

      {detail.isPending ? (
        <Skeleton className="h-96" />
      ) : detail.error || !a ? (
        <ErrorState onRetry={() => void detail.refetch()} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Company context</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{a.company}</p>
                <p className="text-ink-2 text-[13px]">{a.role}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusPill status={a.status} />
                  <Badge tone="neutral" mono size="sm">
                    {a.resumeSnapshot ? "Frozen snapshot" : "No snapshot"}
                  </Badge>
                </div>
                <div className="bg-warn-soft mt-3 rounded-[6px] border-l-[3px] border-[var(--warn)] px-3 py-2 text-[12px]">
                  Prepare against the frozen submission. Master is the wrong
                  source — if the resume changed after you applied, interviewers
                  may still ask about the older version.
                  {!a.resumeSnapshot && (
                    <>
                      {" "}
                      <Link
                        href={`/applications/${a.id}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Freeze a snapshot on the workspace
                      </Link>{" "}
                      before treating this as interview ground truth.
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Likely technical areas</CardTitle>
              </CardHeader>
              <CardContent>
                {topics.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {topics.map((t) => (
                      <span
                        key={t}
                        className="bg-primary-soft text-primary-ink rounded-[5px] px-1.5 py-1 font-mono text-[10.5px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-ink-3 text-[12.5px]">
                    Archive the JD to generate technical topics.
                  </p>
                )}
              </CardContent>
            </Card>
            {aiEnabled.data?.enabled && (
              <Button
                variant="secondary"
                loading={generate.isPending}
                onClick={() =>
                  generate.mutate({
                    resume: resume || " ",
                    jobDescription: jd || " ",
                    company: a.company,
                    role: a.role,
                  })
                }
              >
                Generate questions
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {(
              [
                ["stories", "STAR stories", "Situation → Task → Action → Result. Keep 4–6 reusable stories."],
                ["technical", "Technical prep", "Architecture, APIs, data models, tradeoffs, testing, failure modes…"],
                ["questions", "Questions to ask", "Team ownership, production scale, mentorship, success criteria…"],
                ["notes", "Interview notes", ""],
              ] as const
            ).map(([field, title, placeholder]) => (
              <Card key={field}>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    className="min-h-[110px]"
                    placeholder={placeholder}
                    defaultValue={prep[field] ?? ""}
                    onChange={(e) => autosave(a.id, field, e.target.value)}
                  />
                </CardContent>
              </Card>
            ))}
            {prep.generated && prep.generated.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Generated questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {prep.generated.map((q) => (
                    <div key={q.id} className="border-line border-b pb-2 last:border-0">
                      <p className="text-[13px] font-medium">{q.question}</p>
                      <p className="text-ink-3 font-mono text-[10px]">{q.category}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
