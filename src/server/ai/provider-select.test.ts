import { describe, expect, it } from "vitest";
import {
  anthropicWorkspaceHeaders,
  errorText,
  isAnthropicConfigError,
  resolveAiProvider,
  workspaceIdFromError,
} from "./provider-select";

describe("resolveAiProvider", () => {
  it("prefers Anthropic when both keys exist", () => {
    expect(
      resolveAiProvider({
        anthropic: true,
        openai: true,
        anthropicSkipped: false,
      }),
    ).toBe("anthropic");
  });

  it("uses OpenAI when Anthropic is skipped after a config error", () => {
    expect(
      resolveAiProvider({
        anthropic: true,
        openai: true,
        anthropicSkipped: true,
      }),
    ).toBe("openai");
  });

  it("honours an explicit OpenAI preference", () => {
    expect(
      resolveAiProvider({
        anthropic: true,
        openai: true,
        preferred: "openai",
        anthropicSkipped: false,
      }),
    ).toBe("openai");
  });

  it("stays on Anthropic when it is the only provider even if skipped", () => {
    expect(
      resolveAiProvider({
        anthropic: true,
        openai: false,
        anthropicSkipped: true,
      }),
    ).toBe("anthropic");
  });

  it("returns null when nothing is configured", () => {
    expect(
      resolveAiProvider({
        anthropic: false,
        openai: false,
        anthropicSkipped: false,
      }),
    ).toBeNull();
  });
});

describe("isAnthropicConfigError", () => {
  it("matches identity-linked keys that need a workspace id", () => {
    expect(
      isAnthropicConfigError(
        new Error(
          "anthropic-workspace-id is required when authenticating with an identity-linked API key",
        ),
      ),
    ).toBe(true);
  });

  it("matches a depleted Anthropic credit balance so OpenAI can take over", () => {
    expect(
      isAnthropicConfigError(
        new Error(
          "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
        ),
      ),
    ).toBe(true);
  });
  it("does not treat overload or rate limits as a config error", () => {
    expect(isAnthropicConfigError(new Error("overloaded_error: 529"))).toBe(false);
    expect(isAnthropicConfigError(new Error("Rate limit exceeded"))).toBe(false);
  });

  it("walks nested causes", () => {
    const nested = new Error("wrapper");
    (nested as Error & { cause: Error }).cause = new Error("invalid api key");
    expect(isAnthropicConfigError(nested)).toBe(true);
    expect(errorText(nested)).toMatch(/invalid api key/);
  });
});

describe("anthropicWorkspaceHeaders", () => {
  it("omits the header when no workspace is configured", () => {
    expect(anthropicWorkspaceHeaders(undefined)).toBeUndefined();
  });

  it("sends anthropic-workspace-id when set", () => {
    expect(anthropicWorkspaceHeaders("wrkspc_01Example")).toEqual({
      "anthropic-workspace-id": "wrkspc_01Example",
    });
  });
});

describe("workspaceIdFromError", () => {
  it("reads the response header off an SDK error", () => {
    expect(
      workspaceIdFromError({
        responseHeaders: { "anthropic-workspace-id": "wrkspc_01FromHeader" },
      }),
    ).toBe("wrkspc_01FromHeader");
  });

  it("ignores headers that are not workspace ids", () => {
    expect(workspaceIdFromError({ responseHeaders: { "request-id": "req_1" } })).toBeUndefined();
  });
});
