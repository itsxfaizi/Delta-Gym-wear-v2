import "server-only";

/**
 * Fixed-window counter for unauthenticated endpoints.
 *
 * ponytail: a per-process Map, so it resets on restart and does not span
 * instances. That is enough to stop a single client grinding order numbers;
 * a shared store (Redis/Postgres) is the upgrade when the app runs multi-instance.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
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
}
