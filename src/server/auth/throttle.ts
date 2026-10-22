import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { consumeRateLimit } from "@/server/rate-limit";

const WINDOW_MS = 15 * 60_000;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Best-effort application throttle. The shared Supabase Auth/edge limits remain
 * required in production because consumeRateLimit is local to one process.
 */
export async function allowPublicAuthAttempt(kind: "sign-in" | "password-reset", email: string): Promise<boolean> {
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  const caller = forwarded.split(",")[0]?.trim() || "unknown";
  const account = digest(email.trim().toLowerCase());
  const network = digest(caller);

  // Count both buckets on every attempt, including a rejected one. This keeps
  // changing email addresses from evading the caller cap.
  const perCaller = consumeRateLimit(`${kind}:caller:${network}`, kind === "sign-in" ? 60 : 30, WINDOW_MS);
  const perAccount = consumeRateLimit(`${kind}:account:${account}`, kind === "sign-in" ? 8 : 3, WINDOW_MS);
  return perCaller.allowed && perAccount.allowed;
}
