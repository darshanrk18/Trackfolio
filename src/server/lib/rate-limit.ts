import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, features } from "@/env";

/**
 * Rate limiting.
 *
 * Backed by Upstash Redis in production. When Redis is not configured (local
 * development, CI) it falls back to an in-process sliding window so the code
 * path is still exercised and abuse is still bounded within a single instance.
 */

export type RateLimitTier = "api" | "mutation" | "ai" | "compile" | "auth" | "export";

interface TierConfig {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

const TIERS: Record<RateLimitTier, TierConfig> = {
  // Generous: ordinary reads.
  api: { limit: 300, windowMs: 60_000 },
  // Writes are cheap but should not be scriptable at scale.
  mutation: { limit: 120, windowMs: 60_000 },
  // Model calls cost real money.
  ai: { limit: 20, windowMs: 60_000 },
  // Each compile hits an external LaTeX service.
  compile: { limit: 15, windowMs: 60_000 },
  // Brute-force protection.
  auth: { limit: 10, windowMs: 60_000 },
  // Exports are IO-heavy.
  export: { limit: 20, windowMs: 300_000 },
};

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
}

const redis = features.rateLimiting
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const limiters = new Map<RateLimitTier, Ratelimit>();

function getLimiter(tier: RateLimitTier): Ratelimit | null {
  if (!redis) return null;
  let limiter = limiters.get(tier);
  if (!limiter) {
    const { limit, windowMs } = TIERS[tier];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: true,
      prefix: `trackfolio:rl:${tier}`,
    });
    limiters.set(tier, limiter);
  }
  return limiter;
}

/** In-memory fallback: timestamps of recent hits, keyed by tier + identifier. */
const memoryBuckets = new Map<string, number[]>();

function memoryCheck(tier: RateLimitTier, identifier: string): RateLimitResult {
  const { limit, windowMs } = TIERS[tier];
  const key = `${tier}:${identifier}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  const hits = (memoryBuckets.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    memoryBuckets.set(key, hits);
    return {
      success: false,
      limit,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + windowMs - now),
    };
  }

  hits.push(now);
  memoryBuckets.set(key, hits);

  // Opportunistic cleanup so the map does not grow without bound.
  if (memoryBuckets.size > 10_000) {
    for (const [k, v] of memoryBuckets) {
      if (v.every((t) => t <= cutoff)) memoryBuckets.delete(k);
    }
  }

  return { success: true, limit, remaining: limit - hits.length, retryAfterMs: 0 };
}

export async function checkRateLimit(
  tier: RateLimitTier,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(tier);
  if (!limiter) return memoryCheck(tier, identifier);

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      retryAfterMs: Math.max(0, result.reset - Date.now()),
    };
  } catch {
    // Never let a rate-limiter outage take down the app; degrade to in-memory.
    return memoryCheck(tier, identifier);
  }
}

/** Test helper: clears the in-memory buckets. */
export function __resetRateLimits(): void {
  memoryBuckets.clear();
}
