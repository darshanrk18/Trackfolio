"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, GitBranch, Lock, Unlock } from "lucide-react";
import { useTRPC } from "@/trpc/react";
import { LatexEditor } from "@/components/editor/latex-editor";
import { PageHeader } from "@/components/app/page-header";
import { ProfilePill } from "@/components/app/status";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PROFILE_GUIDANCE, PROFILE_LABELS } from "@/lib/pipeline";
import { debounce, downloadBlob, formatBytes } from "@/lib/utils";
import { formatCompileFailure } from "@/lib/latex-log";
import type { RoleProfile, TexEngine } from "@/server/db/schema";

const PROFILES = Object.keys(PROFILE_LABELS) as RoleProfile[];

export function ResumeLab() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const search = useSearchParams();
  const urlBranchId = search.get("branch");
  const workspace = useQuery(trpc.documents.workspace.queryOptions({ kind: "resume" }));
  const profile = useQuery(trpc.profile.get.queryOptions());

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [content, setContent] = React.useState("");
  const [note, setNote] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [role, setRole] = React.useState("");
  const [newProfile, setNewProfile] = React.useState<RoleProfile>("general");
  const [engine, setEngine] = React.useState<TexEngine | null>(null);
  const [autoCompile, setAutoCompile] = React.useState<boolean | null>(null);
  const [masterUnlocked, setMasterUnlocked] = React.useState(false);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [compileLog, setCompileLog] = React.useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = React.useState("Not compiled");
  const [pdfOk, setPdfOk] = React.useState<"idle" | "ok" | "warn" | "bad">("idle");
  const [wlInput, setWlInput] = React.useState("");
  const [savedHint, setSavedHint] = React.useState<string | null>(null);

  const resolvedEngine = engine ?? profile.data?.defaultTexEngine ?? "pdflatex";
  const resolvedAutoCompile = autoCompile ?? profile.data?.autoCompile ?? false;

  const initial = workspace.data?.master ?? workspace.data?.branches[0];
  const urlBranch = urlBranchId
    ? workspace.data?.branches.find((b) => b.id === urlBranchId)
    : undefined;
  const resolvedId = activeId ?? urlBranch?.id ?? initial?.id ?? null;
  const branch = workspace.data?.branches.find((b) => b.id === resolvedId);
  const displayContent =
    activeId === null ? (branch?.content ?? initial?.content ?? "") : content;
  const locked = Boolean(branch?.isMaster && !masterUnlocked);

  const invalidate = () => {
    void qc.invalidateQueries(trpc.documents.pathFilter());
    void qc.invalidateQueries(trpc.analysis.pathFilter());
  };

  const saveDraft = useMutation(trpc.documents.saveDraft.mutationOptions());
  const persistDraft = React.useEffectEvent((branchId: string, next: string) => {
    saveDraft.mutate(
      { branchId, content: next },
      {
        onSuccess: (res) =>
          setSavedHint(
            `Draft saved ${res.savedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
          ),
      },
    );
  });

  const [autosave] = React.useState(() =>
    debounce((branchId: string, next: string) => persistDraft(branchId, next), 900),
  );

  React.useEffect(() => () => autosave.cancel(), [autosave]);

  const onChange = (next: string) => {
    if (activeId === null && resolvedId) setActiveId(resolvedId);
    setContent(next);
    if (resolvedId && !locked) autosave(resolvedId, next);
  };

  const createBranch = useMutation(
    trpc.documents.createBranch.mutationOptions({
      onSuccess: (created) => {
        invalidate();
        setActiveId(created.id);
        setContent(created.content);
        toast.success(`Created branch “${created.name}”`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const commit = useMutation(
    trpc.documents.commitVersion.mutationOptions({
      onSuccess: (version) => {
        invalidate();
        setNote("");
        toast.success(`Saved ${version.note}`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const compile = useMutation(
    trpc.latex.compile.mutationOptions({
      onSuccess: (result) => {
        if (result.status === "success" && result.pdfUrl) {
          setPdfUrl(result.pdfUrl);
          setCompileLog(null);
          setPdfOk("ok");
          setPdfStatus(
            result.cached
              ? `Cached · ${formatBytes(result.bytes ?? 0)}`
              : `Compiled · ${formatBytes(result.bytes ?? 0)}`,
          );
        } else {
          setPdfOk("bad");
          setPdfStatus("Compile failed");
          setCompileLog(formatCompileFailure(result));
        }
      },
      onError: (err) => {
        setPdfOk("bad");
        setPdfStatus("Compiler error");
        toast.error(err.message);
      },
    }),
  );

  const persistCompile = React.useEffectEvent((source: string, nextEngine: TexEngine) => {
    if (!source.trim()) return;
    compile.mutate({ source, engine: nextEngine });
  });
  const [autoCompileDebounced] = React.useState(() =>
    debounce((source: string, nextEngine: TexEngine) => {
      persistCompile(source, nextEngine);
    }, 2800),
  );
  React.useEffect(() => () => autoCompileDebounced.cancel(), [autoCompileDebounced]);

  React.useEffect(() => {
    if (resolvedAutoCompile && displayContent.trim() && !locked) {
      autoCompileDebounced(displayContent, resolvedEngine);
    }
  }, [resolvedAutoCompile, displayContent, resolvedEngine, locked, autoCompileDebounced]);

  const addTerm = useMutation(
    trpc.documents.addWatchTerm.mutationOptions({
      onSuccess: () => {
        setWlInput("");
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const removeTerm = useMutation(
    trpc.documents.removeWatchTerm.mutationOptions({
      onSuccess: invalidate,
    }),
  );

  const watch = useQuery({
    ...trpc.analysis.watchlistStatus.queryOptions({
      content: displayContent,
      branchId: resolvedId ?? undefined,
    }),
    enabled: Boolean(resolvedId),
  });

  const switchBranch = (id: string) => {
    const next = workspace.data?.branches.find((b) => b.id === id);
    if (!next) return;
    if (resolvedId && !locked) {
      autosave.flush();
    }
    setActiveId(id);
    setContent(next.content);
    setMasterUnlocked(false);
    toast.message(`Switched to ${next.name}`);
  };

  const exportTex = () => {
    const name = branch?.isMaster
      ? "Resume_Master.tex"
      : `Resume_${[branch?.company, branch?.role].filter(Boolean).join("_") || "branch"}.tex`;
    downloadBlob(displayContent, name.replace(/\s+/g, "_"), "application/x-tex");
  };

  if (workspace.isPending) {
    return <Skeleton className="h-[640px]" />;
  }
  if (workspace.error || !workspace.data) {
    return <ErrorState onRetry={() => void workspace.refetch()} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="ResumeOps workspace"
        title="Resume Lab"
        description="Protected master, tailored branches, live LaTeX compile, version history, and application-safe exports."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="primary" mono>
              {branch?.isMaster ? "MASTER" : (branch?.company || branch?.name || "BRANCH").toUpperCase()}
            </Badge>
            {savedHint && <span className="text-ink-3 font-mono text-[11px]">{savedHint}</span>}
          </div>
        }
      />

      <Card className="mb-3">
        <CardContent className="pt-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-semibold">Branch controls</p>
              <p className="text-ink-2 text-[12.5px]">
                Create a branch before tailoring. Your master stays protected.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (branch?.isMaster) {
                    setMasterUnlocked((v) => !v);
                    toast.message(
                      masterUnlocked ? "Master locked again." : "Master unlocked for this session.",
                    );
                  }
                }}
              >
                {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                {locked ? "Master locked" : "Master unlocked"}
              </Button>
            </div>
          </div>

          <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.9fr_1fr_1.2fr_auto_auto]">
            <Field label="Active branch" htmlFor="branch-select">
              <NativeSelect
                id="branch-select"
                value={resolvedId ?? ""}
                onChange={(e) => switchBranch(e.target.value)}
              >
                {workspace.data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.isMaster ? "MASTER · " : ""}
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Role profile" htmlFor="branch-profile">
              <NativeSelect
                id="branch-profile"
                value={newProfile}
                onChange={(e) => setNewProfile(e.target.value as RoleProfile)}
              >
                {PROFILES.map((p) => (
                  <option key={p} value={p}>
                    {PROFILE_LABELS[p]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Company" htmlFor="branch-company">
              <Input
                id="branch-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Datadog"
              />
            </Field>
            <Field label="Role" htmlFor="branch-role">
              <Input
                id="branch-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Software Engineer Intern"
              />
            </Field>
            <Button
              variant="primary"
              onClick={() =>
                createBranch.mutate({
                  kind: "resume",
                  company: company || undefined,
                  role: role || undefined,
                  profile: newProfile,
                  fromBranchId: resolvedId ?? undefined,
                  content: displayContent,
                })
              }
              loading={createBranch.isPending}
            >
              <GitBranch className="size-3.5" />
              Create branch
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                createBranch.mutate({
                  kind: "resume",
                  name: `${branch?.name ?? "Resume"} copy`,
                  profile: branch?.profile ?? "general",
                  fromBranchId: resolvedId ?? undefined,
                  content: displayContent,
                })
              }
            >
              Duplicate
            </Button>
          </div>

          {branch && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(PROFILE_GUIDANCE[branch.profile] ?? []).map((hint) => (
                <Badge key={hint} tone="neutral" mono size="sm">
                  {hint}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {workspace.data.branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => switchBranch(b.id)}
                className={
                  b.id === resolvedId
                    ? "border-primary bg-primary-soft min-w-[190px] rounded-[8px] border px-3 py-2.5 text-left"
                    : "border-line hover:border-primary min-w-[190px] rounded-[8px] border bg-[var(--surface)] px-3 py-2.5 text-left"
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12.5px] font-semibold">
                    {b.isMaster ? "🔒 " : ""}
                    {b.name}
                  </span>
                  <ProfilePill profile={b.profile} />
                </div>
                <p className="text-ink-3 mt-1 font-mono text-[9.5px]">
                  {b.company || "General"} · {b.role || "Master baseline"}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="border-line bg-surface flex min-h-[640px] flex-col overflow-hidden rounded-[10px] border">
          <div className="border-line bg-surface-2 flex items-center justify-between border-b px-3 py-2">
            <span className="text-ink-2 font-mono text-[10.5px] font-semibold tracking-wide">
              LATEX SOURCE
            </span>
            <span className="text-ink-3 font-mono text-[10px]">⌘S saves a version</span>
          </div>
          <LatexEditor
            value={displayContent}
            onChange={onChange}
            onSave={() =>
              resolvedId &&
              commit.mutate({
                branchId: resolvedId,
                note: note || undefined,
                content: displayContent,
              })
            }
            readOnly={locked}
            height="640px"
          />
          <div className="border-line flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2.5">
            <div className="flex flex-wrap gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Version note (e.g. Datadog backend v2)"
                className="w-[260px]"
              />
              <Button
                variant="primary"
                size="sm"
                loading={commit.isPending}
                disabled={locked}
                onClick={() =>
                  resolvedId &&
                  commit.mutate({
                    branchId: resolvedId,
                    note: note || undefined,
                    content: displayContent,
                  })
                }
              >
                Save version
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={locked || !resolvedId}
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
                  toast.success("Copied source");
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={exportTex}>
                <Download className="size-3.5" />
                Export .tex
              </Button>
            </div>
          </div>
        </div>

        <div className="border-line bg-surface flex min-h-[640px] flex-col overflow-hidden rounded-[10px] border">
          <div className="border-line bg-surface-2 flex items-center justify-between border-b px-3 py-2">
            <span className="text-ink-2 font-mono text-[10.5px] font-semibold tracking-wide">
              PDF PREVIEW
            </span>
            <span
              className={
                pdfOk === "ok"
                  ? "text-ok font-mono text-[11px]"
                  : pdfOk === "bad"
                    ? "text-bad font-mono text-[11px]"
                    : "text-ink-3 font-mono text-[11px]"
              }
            >
              {compile.isPending ? "Compiling…" : pdfStatus}
            </span>
          </div>
          {pdfUrl ? (
            <iframe
              title="Resume PDF preview"
              src={pdfUrl}
              className="min-h-[640px] w-full flex-1 bg-[#777]"
            />
          ) : (
            <div className="bg-sunken flex min-h-[640px] flex-1 items-center justify-center px-8 text-center">
              <div>
                <p className="text-[15px] font-semibold">Compile your resume</p>
                <p className="text-ink-3 mt-1 text-[12.5px]">
                  Trackfolio sends the LaTeX source to the compiler only when you ask.
                  The resulting PDF is shown here.
                </p>
              </div>
            </div>
          )}
          {compileLog && (
            <pre className="bg-sunken border-line max-h-[220px] overflow-auto border-t px-3 py-2 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap">
              {compileLog}
            </pre>
          )}
          <div className="border-line flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2.5">
            <div className="flex items-center gap-3">
              <NativeSelect
                value={resolvedEngine}
                onChange={(e) => setEngine(e.target.value as TexEngine)}
              >
                <option value="pdflatex">pdfLaTeX</option>
                <option value="xelatex">XeLaTeX</option>
                <option value="lualatex">LuaLaTeX</option>
              </NativeSelect>
              <label className="text-ink-2 flex items-center gap-1.5 text-[11.5px]">
                <input
                  type="checkbox"
                  checked={resolvedAutoCompile}
                  onChange={(e) => setAutoCompile(e.target.checked)}
                />
                Auto compile
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={compile.isPending}
                onClick={() =>
                  compile.mutate({ source: displayContent, engine: resolvedEngine })
                }
              >
                Compile
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={compile.isPending}
                onClick={() => {
                  compile.mutate(
                    { source: displayContent, engine: resolvedEngine },
                    {
                      onSuccess: (result) => {
                        if (result.pdfUrl) {
                          const a = document.createElement("a");
                          a.href = result.pdfUrl;
                          a.download = "Resume.pdf";
                          a.target = "_blank";
                          a.rel = "noreferrer";
                          a.click();
                        }
                      },
                    },
                  );
                }}
              >
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      <h3 className="mt-6 mb-1 text-[14.5px] font-semibold">Keyword guardrails</h3>
      <p className="text-ink-2 mb-2.5 text-[13px]">
        Terms that should never silently vanish while tailoring. Trackfolio checks them
        against the active branch.
      </p>
      <div className="mb-2.5 flex gap-2">
        <Input
          value={wlInput}
          onChange={(e) => setWlInput(e.target.value)}
          placeholder="e.g. AWS IAM"
          className="w-[200px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && wlInput.trim()) {
              addTerm.mutate({ term: wlInput.trim() });
            }
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={!wlInput.trim()}
          onClick={() => addTerm.mutate({ term: wlInput.trim() })}
        >
          Add term
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!watch.data?.terms.length ? (
          <EmptyState
            title="No watched terms yet"
            description="Add skills you must keep, then tailor freely."
            className="w-full py-8"
          />
        ) : (
          watch.data.terms.map((item) => (
            <Chip
              key={item.term}
              tone={item.present ? "ok" : "bad"}
              onRemove={() => removeTerm.mutate({ term: item.term })}
            >
              {item.present ? "✓" : "✕"} {item.term}
            </Chip>
          ))
        )}
      </div>
    </>
  );
}
