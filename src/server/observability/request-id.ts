import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

const REQUEST_ID_HEADER = "x-request-id";

function normalizeRequestId(incoming: string | null | undefined): string {
  const trimmed = incoming?.trim();
  return trimmed && trimmed.length <= 128 ? trimmed : crypto.randomUUID();
}

export function getOrCreateRequestId(request: Request): string {
  return normalizeRequestId(request.headers.get(REQUEST_ID_HEADER));
}

/**
 * Correlation id for server work that has no `Request` in scope (server
 * components, server actions). Memoised per request, and falls back to a fresh
 * id outside a request scope (prerender, tests) instead of throwing.
 */
export const getRequestId = cache(async (): Promise<string> => {
  try {
    return normalizeRequestId((await headers()).get(REQUEST_ID_HEADER));
  } catch {
    return crypto.randomUUID();
  }
});

export { REQUEST_ID_HEADER };
