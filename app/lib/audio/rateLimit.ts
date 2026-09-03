// Minimal per-user rate limiter for the audio endpoints (GitHub #285).
//
// The repo has no rate-limit middleware (it's not an Express app), so this is a
// tiny fixed-window counter on the existing Redis connection (ioredis is
// already a dependency). Keyed by authenticated userId, so one user spamming
// /presign or /confirm can't rack up storage / job enqueues.
//
// Fails OPEN (logs + allows) when Redis is unreachable — the audio feature
// must not break because rate limiting is down in a local/dev environment.

import connection from "../redis";

export type RateLimitScope = "presign" | "confirm";

export function audioRateLimitKey(userId: string, scope: RateLimitScope): string {
  return `audio:rate-limit:${scope}:${userId}`;
}

const LIMITS: Record<RateLimitScope, number> = {
  presign: 30, // one presign per ~2s per user
  confirm: 60,
};

const WINDOW_SECONDS = 60;

/**
 * Redis can be down in local/dev (no server listening) — with
 * maxRetriesPerRequest:null an ioredis command then never settles, which would
 * hang every audio request. Bound each call with a short timeout so we fail
 * open quickly.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const RATE_LIMIT_COMMAND_TIMEOUT_MS = 750;

/**
 * Returns true when `userId` has exceeded the per-scope window budget.
 */
export async function isAudioRateLimited(userId: string, scope: RateLimitScope): Promise<boolean> {
  return isRateLimited(audioRateLimitKey(userId, scope), LIMITS[scope], WINDOW_SECONDS);
}

export async function isRateLimited(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const count = await withTimeout(connection.incr(key), RATE_LIMIT_COMMAND_TIMEOUT_MS);
    if (count === null) {
      // Timed out — treat Redis as unavailable and allow.
      return false;
    }
    if (count === 1) {
      await withTimeout(connection.expire(key, windowSeconds), RATE_LIMIT_COMMAND_TIMEOUT_MS);
    }
    return count > limit;
  } catch (error) {
    console.warn(
      "[rate-limit] Redis unavailable, failing open:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
