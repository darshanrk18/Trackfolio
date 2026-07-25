import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db, txClient } from "@/server/db";
import { currentUser, ensureProfile, type SessionUser } from "@/server/auth";
import { checkRateLimit, type RateLimitTier } from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

export interface CreateContextOptions {
  headers: Headers;
  user?: SessionUser | null;
}

/**
 * Per-request context. The session is resolved once here rather than in each
 * procedure, and `db` is handed down so tests can swap in a transaction.
 */
export async function createTRPCContext(opts: CreateContextOptions) {
  const user = opts.user !== undefined ? opts.user : await currentUser();
  const ip =
    opts.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    opts.headers.get("x-real-ip") ??
    "unknown";

  return {
    db,
    txClient,
    user,
    ip,
    headers: opts.headers,
    requestId: crypto.randomUUID(),
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Surface field-level validation errors to the client in a usable shape.
        zodError:
          error.cause instanceof ZodError
            ? z4FlattenIssues(error.cause)
            : null,
      },
    };
  },
});

/** Zod v4 removed `.flatten()`; build the same shape from `issues`. */
function z4FlattenIssues(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/** Logs slow procedures so production regressions are visible. */
const timingMiddleware = t.middleware(async ({ next, path, type }) => {
  const start = performance.now();
  const result = await next();
  const durationMs = Math.round(performance.now() - start);
  if (durationMs > 1_000) {
    logger.warn({ path, type, durationMs }, "slow trpc procedure");
  }
  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Requires an authenticated user. Narrows `ctx.user` to non-null for every
 * downstream procedure, which is what enforces per-user data isolation.
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be signed in to do that.",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

/**
 * Applies a rate limit bucket to a procedure.
 *
 * @example protectedProcedure.use(rateLimited("ai")).mutation(...)
 */
export function rateLimited(tier: RateLimitTier) {
  return t.middleware(async ({ ctx, next, path }) => {
    const identifier = ctx.user?.id ?? ctx.ip;
    const result = await checkRateLimit(tier, identifier);
    if (!result.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit reached for ${path}. Try again in ${Math.ceil(
          result.retryAfterMs / 1000,
        )}s.`,
      });
    }
    return next();
  });
}

/** Ensures the user's profile row exists before the procedure body runs. */
export const profileProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const profile = await ensureProfile(ctx.user.id);
  return next({ ctx: { ...ctx, profile } });
});
