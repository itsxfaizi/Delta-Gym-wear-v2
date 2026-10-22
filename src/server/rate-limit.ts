import "server-only";

import { createHash } from "node:crypto";

/**
 * Fixed-window counter for unauthenticated endpoints.
 *
 * ponytail: a per-process Map, so it resets on restart and does not span
 * instances. That is enough to stop a single client grinding order numbers;
 * a shared store (Redis/Postgres) is the upgrade when the app runs multi-instance.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_WINDOWS = 10_000;
const SWEEP_EVERY = 256;
let callsSinceSweep = 0;
let nextExpiryAt = Number.POSITIVE_INFINITY;

function sweepExpired(now: number): void {
  nextExpiryAt = Number.POSITIVE_INFINITY;
  for (const [key, window] of windows) {
    if (now >= window.resetAt) windows.delete(key);
    else nextExpiryAt = Math.min(nextExpiryAt, window.resetAt);
  }
  callsSinceSweep = 0;
}

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  // Caller-derived keys may be long or contain personal data. Store only a
  // fixed-size digest, then cap the number of distinct live windows.
  const storedKey = createHash("sha256").update(key).digest("hex");
  callsSinceSweep += 1;
  if (callsSinceSweep >= SWEEP_EVERY) sweepExpired(now);
  const existing = windows.get(storedKey);

  if (!existing || now >= existing.resetAt) {
    if (!existing && windows.size >= MAX_WINDOWS) {
      if (now >= nextExpiryAt) sweepExpired(now);
      if (windows.size >= MAX_WINDOWS) {
        return { allowed: false, retryAfterMs: Math.max(1, nextExpiryAt - now) };
      }
    }
    const resetAt = now + windowMs;
    windows.set(storedKey, { count: 1, resetAt });
    nextExpiryAt = Math.min(nextExpiryAt, resetAt);
    return { allowed: true, retryAfterMs: 0 };
  }

  existing.count += 1;
  return existing.count <= limit
    ? { allowed: true, retryAfterMs: 0 }
    : { allowed: false, retryAfterMs: existing.resetAt - now };
}

/** Test seam: the Map is module state, so suites must be able to clear it. */
export function __resetRateLimits(): void {
  windows.clear();
  callsSinceSweep = 0;
  nextExpiryAt = Number.POSITIVE_INFINITY;
}
