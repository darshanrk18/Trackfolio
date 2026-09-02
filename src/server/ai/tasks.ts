import { generateObject } from "ai";
import { z } from "zod";
import { extractRequirements, matchAgainstResume, stripLatex } from "@/lib/analysis";
import type { Database } from "@/server/db";
import { logger } from "@/server/lib/logger";
import {
  COVER_LETTER_SYSTEM,
  GAP_ANALYSIS_SYSTEM,
  INTERVIEW_QUESTIONS_SYSTEM,
  JD_EXTRACT_SYSTEM,
  REWRITE_BULLET_SYSTEM,
  TAILOR_RESUME_SYSTEM,
} from "./prompts";
import {
  applyAnthropicWorkspace,
  discoverAnthropicWorkspace,
  getModel,
  isAiEnabled,
  recordAiRun,
  skipAnthropic,
  type AiTask,
} from "./provider";
import { errorText, isAnthropicConfigError, workspaceIdFromError } from "./provider-select";

/**
 * The AI task layer. Each task owns its output schema, its prompt assembly, and
 * its audit row; routers stay thin and never talk to a model directly.
 */

export interface TaskContext {
  db: Database;
  userId: string;
  /** Links the run to an application in the audit trail. */
  applicationId?: string;
}

interface StructuredCall<S extends z.ZodType> {
  ctx: TaskContext;
  task: AiTask;
  system: string;
  prompt: string;
  schema: S;
  schemaName: string;
  temperature?: number;
}

async function runStructured<S extends z.ZodType>({
  ctx,
  task,
  system,
  prompt,
  schema,
  schemaName,
  temperature = 0.3,
}: StructuredCall<S>): Promise<z.infer<S>> {
  if (!isAiEnabled()) {
    throw new Error("AI is not configured");
  }

  const startedAt = performance.now();
  let resolved = getModel(task);

  const call = async () => {
    // `generateObject` is deprecated in AI SDK v7 in favour of `generateText`
    // with an `output` specification. Every structured call funnels through
    // here, so that migration is a change to this function alone.
    const result = await generateObject({
      model: resolved.model,
      schema,
      schemaName,
      system,
      prompt,
      // OpenAI's reasoning models reject any temperature other than the
      // default, so it is only applied where it is actually supported.
      ...(resolved.provider === "anthropic" ? { temperature } : {}),
      maxRetries: 2,
    });

    await recordAiRun({
      db: ctx.db,
      userId: ctx.userId,
      applicationId: ctx.applicationId,
      task,
      provider: resolved.provider,
      modelId: resolved.modelId,
      status: "success",
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      durationMs: Math.round(performance.now() - startedAt),
      prompt,
      result: result.object,
    });

    return result.object as z.infer<S>;
  };

  try {
    return await call();
  } catch (error) {
    const message = errorText(error);
    logger.error(
      { err: error, task, provider: resolved.provider, modelId: resolved.modelId },
      "ai task failed",
    );

    await recordAiRun({
      db: ctx.db,
      userId: ctx.userId,
      applicationId: ctx.applicationId,
      task,
      provider: resolved.provider,
      modelId: resolved.modelId,
      status: "error",
      durationMs: Math.round(performance.now() - startedAt),
      prompt,
      error: message,
    });

    if (resolved.provider === "anthropic" && isAnthropicConfigError(error)) {
      const fromError = workspaceIdFromError(error);
      if (fromError) applyAnthropicWorkspace(fromError);
      const workspace = fromError ?? (await discoverAnthropicWorkspace());
      if (workspace) {
        logger.warn({ task, workspace: workspace.slice(0, 12) }, "retrying Anthropic with workspace id");
        resolved = getModel(task);
        try {
          return await call();
        } catch (retryError) {
          logger.error(
            { err: retryError, task, provider: resolved.provider, modelId: resolved.modelId },
            "ai task failed after workspace retry",
          );
          await recordAiRun({
            db: ctx.db,
            userId: ctx.userId,
            applicationId: ctx.applicationId,
            task,
            provider: resolved.provider,
            modelId: resolved.modelId,
            status: "error",
            durationMs: Math.round(performance.now() - startedAt),
            prompt,
            error: errorText(retryError),
          });
        }
      }

      skipAnthropic(message);
      try {
        resolved = getModel(task, "openai");
      } catch {
        throw new Error(`The model could not complete this request: ${message}`);
      }
      logger.warn(
        { task, from: "anthropic", to: resolved.modelId },
        "retrying AI task on OpenAI after Anthropic config error",
      );
      try {
        return await call();
      } catch (fallbackError) {
        const fallbackMessage = errorText(fallbackError);
        logger.error(
          {
            err: fallbackError,
            task,
            provider: resolved.provider,
            modelId: resolved.modelId,
          },
          "ai fallback task failed",
        );
        await recordAiRun({
          db: ctx.db,
          userId: ctx.userId,
          applicationId: ctx.applicationId,
          task,
          provider: resolved.provider,
          modelId: resolved.modelId,
          status: "error",
          durationMs: Math.round(performance.now() - startedAt),
          prompt,
          error: fallbackMessage,
        });
        throw new Error(`The model could not complete this request: ${fallbackMessage}`);
      }
    }

    throw new Error(`The model could not complete this request: ${message}`);
  }
}

/** Models reason better over rendered text than over LaTeX macros. */
function asPlainText(source: string): string {
  return stripLatex(source) || source;
}

function section(title: string, body: string): string {
  return `=== ${title} ===\n${body.trim()}`;
}

// ---------------------------------------------------------------------------
// Rewrite a bullet
// ---------------------------------------------------------------------------

const rewriteBulletSchema = z.object({
  variants: z.array(
    z.object({
      text: z.string().describe("The rewritten bullet."),
      rationale: z
        .string()
        .describe("Why this version is stronger, in one sentence."),
    }),
  ),
  warnings: z
    .array(z.string())
    .describe(
      "Claims that could not be grounded in the input, and what the user would need to confirm. Empty when every variant is fully supported.",
    ),
});

export type RewriteBulletResult = z.infer<typeof rewriteBulletSchema>;

export interface RewriteBulletInput extends TaskContext {
  bullet: string;
  /** Surrounding resume text, used only as evidence — never as new material. */
  context?: string;
  jobDescription?: string;
}

export function rewriteBullet({
  bullet,
  context,
  jobDescription,
  ...ctx
}: RewriteBulletInput): Promise<RewriteBulletResult> {
  const parts = [section("BULLET TO REWRITE", bullet)];
  if (context?.trim()) {
    parts.push(section("SURROUNDING RESUME CONTEXT", asPlainText(context)));
  }
  if (jobDescription?.trim()) {
    parts.push(
      section("TARGET JOB DESCRIPTION", jobDescription),
      "Use the posting only to decide what to emphasise. It is not a source of facts about the candidate.",
    );
  }

  return runStructured({
    ctx,
    task: "rewrite_bullet",
    system: REWRITE_BULLET_SYSTEM,
    prompt: parts.join("\n\n"),
    schema: rewriteBulletSchema,
    schemaName: "bullet_rewrites",
    temperature: 0.5,
  });
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

const gapAnalysisSchema = z.object({
  overallFit: z
    .number()
    .describe("Calibrated fit from 0 to 100, based only on resume evidence."),
  strengths: z
    .array(
      z.object({
        point: z.string(),
        evidence: z.string().describe("The resume text supporting this."),
      }),
    )
    .describe("Genuine overlaps, strongest first."),
  gaps: z.array(
    z.object({
      requirement: z.string(),
      severity: z.enum(["blocking", "important", "minor"]),
      evidence: z
        .string()
        .describe("What the resume does and does not show for this."),
      honestFraming: z
        .string()
        .describe(
          "How to truthfully discuss adjacent experience. Never a way to claim the missing skill.",
        ),
    }),
  ),
  suggestedEmphasis: z
    .array(z.string())
    .describe("Existing resume content that is under-weighted for this role."),
});

export type GapAnalysisResult = z.infer<typeof gapAnalysisSchema>;

export interface AnalyzeGapsInput extends TaskContext {
  resume: string;
  jobDescription: string;
}

export function analyzeGaps({
  resume,
  jobDescription,
  ...ctx
}: AnalyzeGapsInput): Promise<GapAnalysisResult> {
  // The deterministic keyword scan anchors the model to what is literally in
  // the resume, which makes an invented match easier for it to avoid and
  // easier for us to spot.
  const requirements = extractRequirements(jobDescription, { limit: 40 });
  const scan = matchAgainstResume(requirements, resume);
  const scanSummary = scan.terms
    .map(
      (term) =>
        `- ${term.term} (${term.tier}): ${term.present ? "present in resume" : "NOT FOUND in resume"}`,
    )
    .join("\n");

  const prompt = [
    section("RESUME", asPlainText(resume)),
    section("JOB DESCRIPTION", jobDescription),
    section(
      "DETERMINISTIC KEYWORD SCAN",
      `${scanSummary || "No recognised requirements were extracted."}\n\nThis scan is a literal string match. A term marked NOT FOUND is definitively absent from the resume text — do not claim the candidate has it. A term marked present still needs your judgement about depth.`,
    ),
  ].join("\n\n");

  return runStructured({
    ctx,
    task: "gap_analysis",
    system: GAP_ANALYSIS_SYSTEM,
    prompt,
    schema: gapAnalysisSchema,
    schemaName: "gap_analysis",
    temperature: 0.2,
  });
}

// ---------------------------------------------------------------------------
// Tailor a resume
// ---------------------------------------------------------------------------

const tailorResumeSchema = z.object({
  edits: z.array(
    z.object({
      section: z
        .string()
        .describe("Resume section the edit belongs to, e.g. Experience."),
      original: z
        .string()
        .describe(
          "Exact contiguous span copied from RESUME SOURCE, including LaTeX commands, braces, and escapes (\\&, \\%, \\$). Must be locatable with a search.",
        ),
      revised: z
        .string()
        .describe(
          "Drop-in replacement of that same span. Keep surrounding LaTeX macros and escapes unless the edit is specifically removing them.",
        ),
      reason: z.string(),
    }),
  ),
  refusals: z
    .array(z.string())
    .describe(
      "Changes the posting invited but that would require experience the resume does not contain.",
    ),
});

export type TailorResumeResult = z.infer<typeof tailorResumeSchema>;

export interface TailorResumeInput extends TaskContext {
  resume: string;
  jobDescription: string;
  company?: string;
  role?: string;
}

export function tailorResume({
  resume,
  jobDescription,
  company,
  role,
  ...ctx
}: TailorResumeInput): Promise<TailorResumeResult> {
  // Sent unstripped: each edit quotes its `original` so the client can locate
  // the span, which only works against the bytes the user is actually editing.
  const prompt = [
    section("TARGET", `${role ?? "Unspecified role"} at ${company ?? "unspecified company"}`),
    section("RESUME SOURCE", resume),
    section("JOB DESCRIPTION", jobDescription),
  ].join("\n\n");

  return runStructured({
    ctx,
    task: "tailor_resume",
    system: TAILOR_RESUME_SYSTEM,
    prompt,
    schema: tailorResumeSchema,
    schemaName: "resume_edits",
    temperature: 0.3,
  });
}

// ---------------------------------------------------------------------------
// Cover letter
// ---------------------------------------------------------------------------

const coverLetterSchema = z.object({
  letter: z.string().describe("The full letter body, paragraphs separated by blank lines."),
  claimsUsed: z
    .array(z.string())
    .describe("The specific resume facts the letter relies on, each checkable against the resume."),
});

export type CoverLetterResult = z.infer<typeof coverLetterSchema>;

export type CoverLetterTone =
  | "professional"
  | "warm"
  | "direct"
  | "enthusiastic";

export interface GenerateCoverLetterInput extends TaskContext {
  resume: string;
  jobDescription: string;
  company?: string;
  role?: string;
  tone?: CoverLetterTone;
  notes?: string;
}

export function generateCoverLetter({
  resume,
  jobDescription,
  company,
  role,
  tone = "professional",
  notes,
  ...ctx
}: GenerateCoverLetterInput): Promise<CoverLetterResult> {
  const parts = [
    section(
      "TARGET",
      `Role: ${role ?? "unspecified"}\nCompany: ${company ?? "unspecified"}\nTone: ${tone}`,
    ),
    section("RESUME", asPlainText(resume)),
    section("JOB DESCRIPTION", jobDescription),
  ];

  if (notes?.trim()) {
    parts.push(
      section(
        "CANDIDATE NOTES",
        `${notes.trim()}\n\nThese are the candidate's own words and may be treated as fact.`,
      ),
    );
  }

  return runStructured({
    ctx,
    task: "cover_letter",
    system: COVER_LETTER_SYSTEM,
    prompt: parts.join("\n\n"),
    schema: coverLetterSchema,
    schemaName: "cover_letter",
    temperature: 0.5,
  });
}

// ---------------------------------------------------------------------------
// Interview questions
// ---------------------------------------------------------------------------

const interviewQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      category: z.enum([
        "behavioral",
        "technical",
        "system-design",
        "role-specific",
      ]),
      rationale: z
        .string()
        .describe("Why this candidate would be asked this, citing the resume or posting."),
      whatTheyreProbing: z
        .string()
        .describe("The signal the interviewer is testing for."),
    }),
  ),
});

export type InterviewQuestionsResult = z.infer<typeof interviewQuestionsSchema>;

export interface GenerateInterviewQuestionsInput extends TaskContext {
  resume: string;
  jobDescription: string;
  company?: string;
  role?: string;
  count?: number;
}

export function generateInterviewQuestions({
  resume,
  jobDescription,
  company,
  role,
  count = 10,
  ...ctx
}: GenerateInterviewQuestionsInput): Promise<InterviewQuestionsResult> {
  const prompt = [
    section(
      "TARGET",
      `Role: ${role ?? "unspecified"}\nCompany: ${company ?? "unspecified"}`,
    ),
    section("RESUME", asPlainText(resume)),
    section("JOB DESCRIPTION", jobDescription),
    `Generate exactly ${count} questions, spread across the categories in proportion to what this role would actually screen for.`,
  ].join("\n\n");

  return runStructured({
    ctx,
    task: "interview_questions",
    system: INTERVIEW_QUESTIONS_SYSTEM,
    prompt,
    schema: interviewQuestionsSchema,
    schemaName: "interview_questions",
    temperature: 0.6,
  });
}

// ---------------------------------------------------------------------------
// Job posting extraction
// ---------------------------------------------------------------------------

const jobPostingSchema = z.object({
  company: z.string().nullable(),
  role: z.string().nullable(),
  location: z.string().nullable(),
  workMode: z.enum(["onsite", "hybrid", "remote", "unknown"]),
  salaryMin: z.number().nullable().describe("Annual USD, or null if not stated."),
  salaryMax: z.number().nullable().describe("Annual USD, or null if not stated."),
  requirements: z
    .array(z.string())
    .describe("Concrete skills and qualifications, in the posting's own words."),
});

export type JobPostingResult = z.infer<typeof jobPostingSchema>;

export interface ExtractJobPostingInput extends TaskContext {
  text: string;
}

export function extractJobPosting({
  text,
  ...ctx
}: ExtractJobPostingInput): Promise<JobPostingResult> {
  return runStructured({
    ctx,
    task: "jd_extract",
    system: JD_EXTRACT_SYSTEM,
    prompt: section("JOB POSTING", text),
    schema: jobPostingSchema,
    schemaName: "job_posting",
    temperature: 0,
  });
}
