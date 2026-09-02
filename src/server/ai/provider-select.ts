/**
 * Pure provider-selection rules. Kept free of env/SDK imports so the fallback
 * policy can be unit-tested without booting the rest of the server.
 */

export type AiProviderName = "anthropic" | "openai";

export interface ProviderAvailability {
  anthropic: boolean;
  openai: boolean;
  preferred?: AiProviderName;
  /** Set after Anthropic rejects the key as a config/auth problem. */
  anthropicSkipped: boolean;
}

/**
 * Anthropic stays preferred when both keys exist. OpenAI wins only when it is
 * the explicit preference, Anthropic is missing, or Anthropic has already
 * proven unusable for this process (identity-linked key without a workspace).
 */
export function resolveAiProvider({
  anthropic,
  openai,
  preferred,
  anthropicSkipped,
}: ProviderAvailability): AiProviderName | null {
  const wantAnthropic = preferred !== "openai" && anthropic && !anthropicSkipped;
  if (wantAnthropic) return "anthropic";
  if (openai) return "openai";
  if (anthropic) return "anthropic";
  return null;
}

export function errorText(error: unknown): string {
  if (error instanceof Error) {
    const extras: string[] = [];
    if ("cause" in error && error.cause != null) extras.push(errorText(error.cause));
    const rec = error as Error & { data?: unknown; responseBody?: string };
    if (typeof rec.responseBody === "string") extras.push(rec.responseBody);
    if (rec.data != null) {
      try {
        extras.push(JSON.stringify(rec.data));
      } catch {
        extras.push(String(rec.data));
      }
    }
    return [error.message, ...extras].join(" ");
  }
  return String(error);
}

/**
 * Failures that mean this Anthropic key cannot succeed as configured — retrying
 * the same provider is wasted. Rate limits and overloads are not in this set.
 */
export function isAnthropicConfigError(error: unknown): boolean {
  const text = errorText(error);
  return /anthropic-workspace-id|workspace id is required|identity-linked|authentication_error|invalid x-api-key|invalid api key|invalid_api_key|credit balance is too low|purchase credits|too low to access the anthropic api/i.test(
    text,
  );
}

export function anthropicWorkspaceHeaders(
  workspaceId: string | undefined,
): Record<string, string> | undefined {
  if (!workspaceId) return undefined;
  return { "anthropic-workspace-id": workspaceId };
}

/** Pulls a workspace id out of an AI SDK error's response headers, if present. */
export function workspaceIdFromError(error: unknown): string | undefined {
  const headers = headersFromError(error);
  const value =
    headers["anthropic-workspace-id"] ??
    headers["Anthropic-Workspace-Id"] ??
    headers["ANTHROPIC-WORKSPACE-ID"];
  return value?.startsWith("wrkspc_") ? value : undefined;
}

function headersFromError(error: unknown): Record<string, string> {
  if (!error || typeof error !== "object") return {};
  const rec = error as { responseHeaders?: unknown; cause?: unknown };
  if (rec.responseHeaders && typeof rec.responseHeaders === "object") {
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(rec.responseHeaders as Record<string, unknown>)) {
      if (typeof val === "string") out[key] = val;
    }
    return out;
  }
  if (rec.cause) return headersFromError(rec.cause);
  return {};
}
