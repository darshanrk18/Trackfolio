/**
 * Structured logging.
 *
 * Emits newline-delimited JSON in production so Vercel's log drain can index
 * fields, and human-readable lines in development. Deliberately dependency-free
 * to keep the serverless bundle small and cold starts fast.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const MIN_LEVEL: Level =
  (process.env.LOG_LEVEL as Level | undefined) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const isProduction = process.env.NODE_ENV === "production";

/** Keys whose values must never reach a log sink. */
const REDACTED_KEYS = new Set([
  "password","token","secret","apikey","api_key","authorization","cookie","sessiontoken",
  "session_token","access_token","refresh_token","id_token","client_secret","encryptedaikey",
  "encrypted_ai_key","auth_secret","database_url","openai_api_key","anthropic_api_key",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACTED_KEYS.has(k.toLowerCase()) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 4_000) {
    return `${value.slice(0, 4_000)}…[truncated]`;
  }
  return value;
}

function write(level: Level, context: unknown, message?: string): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const isMessageOnly = typeof context === "string";
  const msg = isMessageOnly ? context : (message ?? "");
  const fields = isMessageOnly ? {} : (redact(context) as Record<string, unknown>);

  if (isProduction) {
    process.stdout.write(
      `${JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields })}\n`,
    );
    return;
  }

  const tag = { debug: "·", info: "→", warn: "⚠", error: "✖" }[level];
  const detail = Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : "";
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(`${tag} ${msg}${detail}`);
}

export interface Logger {
  debug(context: unknown, message?: string): void;
  info(context: unknown, message?: string): void;
  warn(context: unknown, message?: string): void;
  error(context: unknown, message?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

function makeLogger(bindings: Record<string, unknown> = {}): Logger {
  const merge = (context: unknown) =>
    typeof context === "string" ? { ...bindings, msg: context } : { ...bindings, ...(context as object) };

  return {
    debug: (c, m) => write("debug", typeof c === "string" && !m ? c : merge(c), m),
    info: (c, m) => write("info", typeof c === "string" && !m ? c : merge(c), m),
    warn: (c, m) => write("warn", typeof c === "string" && !m ? c : merge(c), m),
    error: (c, m) => write("error", typeof c === "string" && !m ? c : merge(c), m),
    child: (extra) => makeLogger({ ...bindings, ...extra }),
  };
}

export const logger = makeLogger();
