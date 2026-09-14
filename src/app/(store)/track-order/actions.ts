"use server";

import { headers } from "next/headers";

import { TRACKING_NOT_FOUND_MESSAGE } from "@/features/orders/tracking";
import { consumeRateLimit } from "@/server/rate-limit";
import { lookupOrderForTracking, type TrackedOrder } from "@/server/orders/tracking";

export type TrackOrderResult = { found: true; order: TrackedOrder } | { found: false; message: string };

/**
 * Public, unauthenticated lookup: the order number alone is guessable, so the
 * phone number is the secret. Every failure returns the same message.
 */
const TRACKING_ATTEMPTS = 10;
const TRACKING_WINDOW_MS = 10 * 60 * 1000;

/** Best-effort caller identity; a missing header collapses everyone into one bucket. */
async function callerKey(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  return `track:${forwarded.split(",")[0]?.trim() || "unknown"}`;
}

export async function trackOrderAction(rawInput: unknown): Promise<TrackOrderResult> {
  // Order numbers are a per-day sequence, so the phone is the only secret. Without a
  // cap an attacker grinds a known phone against a day's numbers in seconds.
  const { allowed } = consumeRateLimit(await callerKey(), TRACKING_ATTEMPTS, TRACKING_WINDOW_MS);
  if (!allowed) return { found: false, message: TRACKING_NOT_FOUND_MESSAGE };

  const order = await lookupOrderForTracking(rawInput);
  return order ? { found: true, order } : { found: false, message: TRACKING_NOT_FOUND_MESSAGE };
}
