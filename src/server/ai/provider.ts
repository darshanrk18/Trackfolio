import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { env, features } from "@/env";
import type { Database } from "@/server/db";
import { aiRuns, aiTaskEnum } from "@/server/db/schema";
import { logger } from "@/server/lib/logger";

/**
 * Model selection, pricing, and the audit trail for every model call.
 *
 * Anthropic is preferred when configured because the grounding instructions in
 * `prompts.ts` are tuned against it; OpenAI is a drop-in fallback.
 */

export type AiTask = (typeof aiTaskEnum.enumValues)[number];
export type AiProviderName = "anthropic" | "openai";

type ModelTier = "fast" | "strong";

const MODELS: Record<AiProviderName, Record<ModelTier, string>> = {
  anthropic: { fast: "claude-haiku-4-5", strong: "claude-sonnet-4-5" },
  openai: { fast: "gpt-5-mini", strong: "gpt-5" },
};

/**
 * Short, well-bounded tasks get the cheap model; anything that rewrites a
 * user's own words or reasons across two documents gets the stronger one,
 * because a weak model is far more likely to drift into inventing content.
 */
const TASK_TIER: Record<AiTask, ModelTier> = {
  rewrite_bullet: "strong",
  tailor_resume: "strong",
  gap_analysis: "strong",
  cover_letter: "strong",
  interview_questions: "fast",
  mock_interview: "fast",
  jd_extract: "fast",
  summarize: "fast",
  company_research: "fast",
};

/**
 * USD per 1M tokens. Provider list prices drift — review this table whenever
 * the default models change, otherwise reported spend silently becomes wrong.
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5": { input: 1.25, output: 10.0 },
};

export interface ResolvedModel {
  model: LanguageModel;
  provider: AiProviderName;
  modelId: string;
}

export function isAiEnabled(): boolean {
  return features.ai;
}

let anthropicProvider: ReturnType<typeof createAnthropic> | undefined;
let openaiProvider: ReturnType<typeof createOpenAI> | undefined;

/**
 * Resolves the model for a task. Providers are created lazily and memoised so
 * a missing key never blows up at import time — only when a task actually runs.
 */
export function getModel(task: AiTask): ResolvedModel {
  const tier = TASK_TIER[task];

  if (env.ANTHROPIC_API_KEY) {
    anthropicProvider ??= createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const modelId = MODELS.anthropic[tier];
    return {
      model: anthropicProvider(modelId),
      provider: "anthropic",
      modelId,
    };
  }

  if (env.OPENAI_API_KEY) {
    openaiProvider ??= createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const modelId = MODELS.openai[tier];
    return { model: openaiProvider(modelId), provider: "openai", modelId };
  }

  throw new Error("AI is not configured");
}

/** Cost of a single call in USD. Unknown models are priced at zero, not guessed. */
export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICING[modelId];
  if (!price) return 0;
  return (
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  );
}

/** Prompts are kept for user transparency, not replay — a head is enough. */
const MAX_STORED_PROMPT_CHARS = 4_000;

export interface RecordAiRunOptions {
  db: Database;
  userId: string;
  task: AiTask;
  provider: AiProviderName;
  modelId: string;
  status?: "success" | "error" | "refused";
  /** Token counts are reported as `undefined` by providers that omit them. */
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  prompt?: string;
  result?: unknown;
  error?: string;
  applicationId?: string;
}

/**
 * Writes the audit row for a model call.
 *
 * Never throws: losing an audit row is not a reason to fail a request the user
 * already paid for.
 */
export async function recordAiRun({
  db,
  userId,
  task,
  provider,
  modelId,
  status = "success",
  inputTokens = 0,
  outputTokens = 0,
  durationMs,
  prompt,
  result,
  error,
  applicationId,
}: RecordAiRunOptions): Promise<void> {
  const costUsd = estimateCost(modelId, inputTokens, outputTokens);

  try {
    await db.insert(aiRuns).values({
      userId,
      applicationId: applicationId ?? null,
      task,
      provider,
      model: modelId,
      status,
      inputTokens,
      outputTokens,
      costUsd: costUsd.toFixed(6),
      durationMs,
      prompt: prompt ? prompt.slice(0, MAX_STORED_PROMPT_CHARS) : null,
      result: result ?? null,
      error: error ? error.slice(0, 2_000) : null,
    });
  } catch (err) {
    logger.error({ err, userId, task }, "failed to record ai run");
  }
}
