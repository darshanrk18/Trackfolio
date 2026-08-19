"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Sparkles } from "lucide-react";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AssistantView() {
  const trpc = useTRPC();
  const enabled = useQuery(trpc.ai.enabled.queryOptions());
  const usage = useQuery(trpc.ai.usage.queryOptions());
  const workspace = useQuery(trpc.documents.workspace.queryOptions({ kind: "resume" }));

  const [bullet, setBullet] = React.useState("");
  const [jd, setJd] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [role, setRole] = React.useState("");
  const [tone, setTone] = React.useState<"professional" | "warm" | "direct" | "enthusiastic">(
    "professional",
  );

  const resume = workspace.data?.master?.content ?? "";

  const rewrite = useMutation(trpc.ai.rewriteBullet.mutationOptions({
    onError: (e) => toast.error(e.message),
  }));
  const gaps = useMutation(trpc.ai.analyzeGaps.mutationOptions({
    onError: (e) => toast.error(e.message),
  }));
  const tailor = useMutation(trpc.ai.tailorResume.mutationOptions({
    onError: (e) => toast.error(e.message),
  }));
  const cover = useMutation(trpc.ai.generateCoverLetter.mutationOptions({
    onError: (e) => toast.error(e.message),
  }));

  if (enabled.isPending) return <Skeleton className="h-40" />;
  if (!enabled.data?.enabled) {
    return (
      <>
        <PageHeader title="AI Assistant" />
        <EmptyState
          icon={<Sparkles />}
          title="AI is not configured on this deployment"
          description="Set OPENAI_API_KEY or ANTHROPIC_API_KEY. Every suggestion stays grounded in your resume — Trackfolio will never invent experience."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Grounded in your source document"
        title="AI Assistant"
        description="Rewrite bullets, find honest gaps, tailor a branch, or draft a cover letter. Gaps get reported. Fabrications get refused."
        actions={
          usage.data && (
            <span className="text-ink-3 font-mono text-[11px]">
              {usage.data.runs} runs this month
            </span>
          )
        }
      />
      <div className="bg-ok-soft text-ok mb-4 flex items-start gap-2 rounded-[8px] px-3 py-2.5 text-[12.5px]">
        <Shield className="mt-0.5 size-4 shrink-0" />
        Every model call is constrained to the resume you actually wrote. If a
        posting asks for a skill you do not have, the assistant will say so.
      </div>

      <Field label="Job description" htmlFor="ai-jd" className="mb-4">
        <Textarea
          id="ai-jd"
          className="min-h-[120px]"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the posting to ground the suggestion…"
        />
      </Field>

      <Tabs defaultValue="bullet">
        <TabsList>
          <TabsTrigger value="bullet">Rewrite bullet</TabsTrigger>
          <TabsTrigger value="gaps">Gap analysis</TabsTrigger>
          <TabsTrigger value="tailor">Tailor resume</TabsTrigger>
          <TabsTrigger value="cover">Cover letter</TabsTrigger>
        </TabsList>

        <TabsContent value="bullet">
          <Textarea
            className="min-h-[90px]"
            value={bullet}
            onChange={(e) => setBullet(e.target.value)}
            placeholder="Paste a weak bullet…"
          />
          <Button
            variant="primary"
            className="mt-2"
            loading={rewrite.isPending}
            onClick={() =>
              rewrite.mutate({ bullet, context: resume, jobDescription: jd || undefined })
            }
          >
            Rewrite
          </Button>
          {rewrite.data && (
            <div className="mt-3 space-y-2">
              {rewrite.data.variants.map((variant, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 text-[13.5px] leading-relaxed">
                    <p className="font-medium">{variant.text}</p>
                    <p className="text-ink-2 mt-2 text-[12.5px]">{variant.rationale}</p>
                  </CardContent>
                </Card>
              ))}
              {rewrite.data.warnings.length > 0 && (
                <p className="text-warn text-[12.5px]">
                  {rewrite.data.warnings.join(" ")}
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gaps">
          <Button
            variant="primary"
            loading={gaps.isPending}
            disabled={!jd.trim()}
            onClick={() => gaps.mutate({ resume, jobDescription: jd })}
          >
            Find honest gaps
          </Button>
          {gaps.data && (
            <div className="mt-3 space-y-2">
              {gaps.data.gaps.map((gap, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle>{gap.requirement}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-[13px]">
                    <p className="text-ink-3 font-mono text-[10px] uppercase">
                      {gap.severity}
                    </p>
                    <p className="mt-1">{gap.evidence}</p>
                    <p className="text-ink-2 mt-1">{gap.honestFraming}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tailor">
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" />
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
          </div>
          <Button
            variant="primary"
            loading={tailor.isPending}
            disabled={!jd.trim()}
            onClick={() =>
              tailor.mutate({ resume, jobDescription: jd, company, role })
            }
          >
            Propose tailoring
          </Button>
          {tailor.data && (
            <div className="mt-3 space-y-2">
              {tailor.data.edits.map((edit, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle>{edit.section}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-[13px]">
                    <p className="text-bad line-through">{edit.original}</p>
                    <p className="text-ok mt-1">{edit.revised}</p>
                    <p className="text-ink-2 mt-1 text-[12.5px]">{edit.reason}</p>
                  </CardContent>
                </Card>
              ))}
              {tailor.data.refusals.length > 0 && (
                <div className="bg-warn-soft rounded-[8px] px-3 py-2 text-[12.5px]">
                  {tailor.data.refusals.map((r) => (
                    <p key={r}>{r}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cover">
          <div className="mb-2 grid gap-2 sm:grid-cols-3">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" />
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
            <NativeSelect
              value={tone}
              onChange={(e) =>
                setTone(e.target.value as typeof tone)
              }
            >
              <option value="professional">Professional</option>
              <option value="warm">Warm</option>
              <option value="direct">Direct</option>
              <option value="enthusiastic">Enthusiastic</option>
            </NativeSelect>
          </div>
          <Button
            variant="primary"
            loading={cover.isPending}
            disabled={!jd.trim()}
            onClick={() =>
              cover.mutate({ resume, jobDescription: jd, company, role, tone })
            }
          >
            Draft cover letter
          </Button>
          {cover.data && (
            <Card className="mt-3">
              <CardContent className="pt-4 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                {cover.data.letter}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
