import { z } from "zod";

/**
 * Runtime-validated environment. Import this instead of touching `process.env`
 * directly so a missing variable fails at boot rather than mid-request.
 *
 * Server-only values are stripped from the client bundle by Next's `NEXT_PUBLIC_`
 * convention; nothing here without that prefix is ever sent to the browser.
 */

/** Empty strings in `.env.local` (`KEY=""`) must count as unset, not invalid. */
const OptionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // --- Database -----------------------------------------------------------
  DATABASE_URL: z
    .string()
    .url()
    .describe("Neon Postgres pooled connection string"),

  // --- Auth ---------------------------------------------------------------
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters. Generate with: openssl rand -base64 32"),
  AUTH_URL: OptionalString,
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),

  AUTH_GITHUB_ID: OptionalString,
  AUTH_GITHUB_SECRET: OptionalString,
  AUTH_GOOGLE_ID: OptionalString,
  AUTH_GOOGLE_SECRET: OptionalString,

  // --- Email --------------------------------------------------------------
  RESEND_API_KEY: OptionalString,
  EMAIL_FROM: z.string().default("Trackfolio <onboarding@resend.dev>"),

  // --- AI -----------------------------------------------------------------
  OPENAI_API_KEY: OptionalString,
  ANTHROPIC_API_KEY: OptionalString,
  /** Required for multi-workspace / identity-linked Anthropic keys. */
  ANTHROPIC_WORKSPACE_ID: OptionalString,
  AI_PREFERRED_PROVIDER: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["anthropic", "openai"]).optional(),
  ),

  // --- Storage ------------------------------------------------------------
  BLOB_READ_WRITE_TOKEN: OptionalString,

  // --- Rate limiting ------------------------------------------------------
  UPSTASH_REDIS_REST_URL: OptionalString,
  UPSTASH_REDIS_REST_TOKEN: OptionalString,

  // --- LaTeX --------------------------------------------------------------
  LATEX_COMPILER_URL: z
    .string()
    .url()
    .default("https://texlive.net/cgi-bin/latexcgi"),

  // --- Jobs ---------------------------------------------------------------
  CRON_SECRET: OptionalString,
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Trackfolio"),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

function format(error: z.ZodError): string {
  return error.issues
    .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/**
 * During `next build` Next.js imports modules to collect metadata without real
 * secrets present. We skip hard validation in that phase so CI builds don't need
 * production credentials, but still validate at actual runtime.
 */
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.SKIP_ENV_VALIDATION === "true";

function parseServer(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (parsed.success) return parsed.data;

  if (isBuildPhase) {
    // Permissive placeholders — never used to serve a real request.
    return serverSchema.parse({
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgres://build:build@localhost:5432/build",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "x".repeat(32),
    });
  }

  throw new Error(
    `Invalid server environment variables:\n${format(parsed.error)}\n\n` +
      `Copy .env.example to .env.local and fill in the required values.`,
  );
}

function parseClient(): ClientEnv {
  // Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so these must be
  // referenced statically rather than via a spread of `process.env`.
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });
  if (parsed.success) return parsed.data;
  throw new Error(
    `Invalid public environment variables:\n${format(parsed.error)}`,
  );
}

export const clientEnv = parseClient();

let cachedServerEnv: ServerEnv | undefined;

/**
 * Lazily validated server env. Accessing a server-only variable from a client
 * component throws immediately instead of silently reading `undefined`.
 */
export const env: ServerEnv & ClientEnv = new Proxy({} as ServerEnv & ClientEnv, {
  get(_target, prop: string) {
    if (prop in clientEnv) return clientEnv[prop as keyof ClientEnv];
    if (typeof window !== "undefined") {
      throw new Error(
        `Attempted to read server-only environment variable "${prop}" in the browser.`,
      );
    }
    cachedServerEnv ??= parseServer();
    return cachedServerEnv[prop as keyof ServerEnv];
  },
});

/** Feature flags derived from which credentials are actually configured. */
export const features = {
  get ai(): boolean {
    return Boolean(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY);
  },
  get email(): boolean {
    return Boolean(env.RESEND_API_KEY);
  },
  get blobStorage(): boolean {
    return Boolean(env.BLOB_READ_WRITE_TOKEN);
  },
  get rateLimiting(): boolean {
    return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  },
  get githubAuth(): boolean {
    return Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET);
  },
  get googleAuth(): boolean {
    return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
  },
} as const;
