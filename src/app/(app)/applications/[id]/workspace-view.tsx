"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import JSZip from "jszip";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { Timeline } from "@/components/app/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { FUNNEL_STAGES, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/pipeline";
import { downloadBlob, formatDateTime, safeFilename } from "@/lib/utils";
import type { ApplicationStatus, Priority } from "@/server/db/schema";

const STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

export function ApplicationWorkspace({ id }: { id: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const app = useQuery(trpc.applications.byId.queryOptions({ id }));
  const versions = useQuery(
    trpc.documents.listVersions.queryOptions({ kind: "resume", limit: 80 }),
  );
  const coverVersions = useQuery(
    trpc.documents.listVersions.queryOptions({ kind: "cover_letter", limit: 80 }),
  );

  const invalidate = () => {
    void qc.invalidateQueries(trpc.applications.pathFilter());
    void qc.invalidateQueries(trpc.insights.pathFilter());
  };

  const update = useMutation(
    trpc.applications.update.mutationOptions({
      onSuccess: invalidate,
      onError: (err) => toast.error(err.message),
    }),
  );
  const setJd = useMutation(
    trpc.applications.setJobDescription.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Job description archived");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const snapshot = useMutation(
    trpc.applications.captureSnapshot.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Submission snapshot frozen");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const addEvent = useMutation(
    trpc.applications.addEvent.mutationOptions({
      onSuccess: () => {
        setEventLabel("");
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const [eventLabel, setEventLabel] = React.useState("");
  const [jdDraft, setJdDraft] = React.useState<string | null>(null);

  const a = app.data;

  if (app.isPending) return <Skeleton className="h-[480px]" />;
  if (app.error || !a) {
    return (
      <ErrorState
        title="Application not found"
        onRetry={() => void app.refetch()}
      />
    );
  }

  const jdValue = jdDraft ?? a.jobDescription ?? "";

  const stageIdx = Math.max(
    0,
    FUNNEL_STAGES.indexOf(a.status as (typeof FUNNEL_STAGES)[number]),
  );

  const exportPackage = async () => {
    const zip = new JSZip();
    const base = `${safeFilename(a.company)}_${safeFilename(a.role || "role")}`;
    if (a.resumeSnapshot) zip.file("Resume.tex", a.resumeSnapshot);
    if (a.coverLetterSnapshot) zip.file("Cover_Letter.txt", a.coverLetterSnapshot);
    if (a.jobDescription) zip.file("Job_Description.txt", a.jobDescription);
    zip.file(
      "Application_Record.json",
      JSON.stringify(
        {
          company: a.company,
          role: a.role,
          status: a.status,
          appliedOn: a.appliedOn,
          jobUrl: a.jobUrl,
          submittedAt: a.submittedAt,
          exportedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${base}.zip`, "application/zip");
    toast.success("Exported application package");
  };

  const patch = (partial: Omit<Parameters<typeof update.mutate>[0], "id">) =>
    update.mutate({ ...partial, id: a.id });

  return (
    <>
      <PageHeader
        eyebrow="One company, everything together"
        title={`${a.company}${a.role ? ` — ${a.role}` : ""}`}
        description="Keep the original JD, exact submitted documents, contacts, timeline, next action, and interview dates attached to the application."
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/applications">All applications</Link>
            </Button>
            <Button variant="primary" size="sm" onClick={() => void exportPackage()}>
              Export package
            </Button>
          </>
        }
      />

      <div className="mb-4 grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Status">
          <NativeSelect
            value={a.status}
            onChange={(e) => patch({ status: e.target.value as ApplicationStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Priority">
          <NativeSelect
            value={a.priority}
            onChange={(e) => patch({ priority: e.target.value as Priority })}
          >
            {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Follow-up">
          <Input
            type="date"
            defaultValue={a.followUpOn ?? ""}
            onBlur={(e) => patch({ followUpOn: e.target.value || null })}
          />
        </Field>
        <Field label="Interview">
          <Input
            type="datetime-local"
            defaultValue={
              a.interviewOn
                ? new Date(a.interviewOn).toISOString().slice(0, 16)
                : ""
            }
            onBlur={(e) =>
              patch({ interviewOn: e.target.value ? new Date(e.target.value) : null })
            }
          />
        </Field>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {FUNNEL_STAGES.map((stage, i) => (
          <span
            key={stage}
            className={
              i < stageIdx
                ? "bg-ok-soft text-ok rounded-[5px] px-2 py-1 font-mono text-[9.5px]"
                : i === stageIdx
                  ? "bg-primary-soft text-primary-ink rounded-[5px] px-2 py-1 font-mono text-[9.5px] font-semibold"
                  : "border-line text-ink-3 rounded-[5px] border px-2 py-1 font-mono text-[9.5px]"
            }
          >
            {STATUS_LABELS[stage]}
          </span>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-3">
          <Card>
            <CardContent className="grid gap-2 pt-4 sm:grid-cols-3">
              <Field label="Job ID">
                <Input
                  defaultValue={a.jobId ?? ""}
                  onBlur={(e) => patch({ jobId: e.target.value })}
                />
              </Field>
              <Field label="Location">
                <Input
                  defaultValue={a.location ?? ""}
                  onBlur={(e) => patch({ location: e.target.value })}
                />
              </Field>
              <Field label="Source">
                <Input
                  defaultValue={a.source ?? ""}
                  placeholder="Referral / LinkedIn"
                  onBlur={(e) => patch({ source: e.target.value })}
                />
              </Field>
              <Field label="Job URL" className="sm:col-span-2">
                <Input
                  defaultValue={a.jobUrl ?? ""}
                  onBlur={(e) => patch({ jobUrl: e.target.value })}
                />
              </Field>
              <Field label="Next step">
                <Input
                  defaultValue={a.nextStep ?? ""}
                  onBlur={(e) => patch({ nextStep: e.target.value })}
                />
              </Field>
              <Field label="Notes" className="sm:col-span-3">
                <Textarea
                  defaultValue={a.notes}
                  onBlur={(e) => patch({ notes: e.target.value })}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Original job description</CardTitle>
              <Badge tone="neutral" mono size="sm">
                ARCHIVED WITH APPLICATION
              </Badge>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[280px]"
                value={jdValue}
                onChange={(e) => setJdDraft(e.target.value)}
                onBlur={() => {
                  if (jdDraft !== null && jdDraft !== (a.jobDescription ?? "")) {
                    setJd.mutate({ id: a.id, jobDescription: jdDraft });
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-sunken border-line mb-2 rounded-[7px] border p-2.5">
                <p className="text-[12.5px] font-semibold">
                  {a.resumeSnapshot ? "Frozen submission" : "No immutable snapshot yet"}
                </p>
                <p className="text-ink-3 font-mono text-[9.5px]">
                  {a.submittedAt
                    ? formatDateTime(a.submittedAt)
                    : "Capture one before or immediately after applying."}
                </p>
              </div>
              <Field label="Resume version" className="mb-2">
                <NativeSelect
                  value={a.resumeVersionId ?? ""}
                  onChange={(e) =>
                    patch({ resumeVersionId: e.target.value || null })
                  }
                >
                  <option value="">(none)</option>
                  {(versions.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.note || `v${v.revision}`}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Cover letter" className="mb-2">
                <NativeSelect
                  value={a.coverLetterVersionId ?? ""}
                  onChange={(e) =>
                    patch({ coverLetterVersionId: e.target.value || null })
                  }
                >
                  <option value="">(none)</option>
                  {(coverVersions.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.note || `v${v.revision}`}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Button
                variant="secondary"
                size="sm"
                className="mt-1"
                loading={snapshot.isPending}
                onClick={() => snapshot.mutate({ id: a.id })}
              >
                Capture / refresh snapshot
              </Button>
              {a.resumeSnapshot && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 ml-2"
                  onClick={() =>
                    downloadBlob(
                      a.resumeSnapshot!,
                      `${safeFilename(a.company)}_submitted.tex`,
                      "application/x-tex",
                    )
                  }
                >
                  Export snapshot .tex
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="mb-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!eventLabel.trim()) return;
                  addEvent.mutate({
                    applicationId: a.id,
                    label: eventLabel.trim(),
                  });
                }}
              >
                <Input
                  value={eventLabel}
                  onChange={(e) => setEventLabel(e.target.value)}
                  placeholder="Add a note…"
                />
                <Button variant="secondary" size="sm" type="submit">
                  Add
                </Button>
              </form>
              <Timeline
                compact
                items={a.events.map((ev) => ({
                  id: ev.id,
                  label: ev.label,
                  at: ev.occurredAt,
                  body: ev.body,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related contacts</CardTitle>
            </CardHeader>
            <CardContent>
              {a.contacts.length === 0 ? (
                <p className="text-ink-3 text-[12.5px]">
                  No contacts linked yet.{" "}
                  <Link href="/contacts" className="text-primary underline-offset-2 hover:underline">
                    Add one
                  </Link>
                </p>
              ) : (
                a.contacts.map((c) => (
                  <div key={c.id} className="border-line border-b py-1.5 last:border-0">
                    <p className="text-[13px] font-semibold">{c.name}</p>
                    <p className="text-ink-3 text-[12px]">
                      {c.relation || "Contact"}
                      {c.lastContactedOn ? ` · last ${c.lastContactedOn}` : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
