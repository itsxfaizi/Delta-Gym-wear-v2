import { z } from "zod";

import { ORDER_STATUS_META, describeStatus, persistableStatus, type CodStatus, type StatusMeta } from "./status";

/** One generic message for every failed lookup: never reveal whether an order number exists. */
export const TRACKING_NOT_FOUND_MESSAGE = "We could not find that order. Check the order number and phone number and try again.";

export function normalizeOrderNumber(value: string): string {
  return value.trim().toUpperCase();
}

/** Digits only; a Pakistani number is written as 0328…, +92 328… or 92328… for the same line. */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

const PHONE_MATCH_DIGITS = 9;

/** Compares the subscriber part so 03285386793 and +92 328 5386793 are the same line. */
export function phonesMatch(a: string, b: string): boolean {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  if (left.length < PHONE_MATCH_DIGITS || right.length < PHONE_MATCH_DIGITS) return false;
  return left.slice(-PHONE_MATCH_DIGITS) === right.slice(-PHONE_MATCH_DIGITS);
}

/** Shared by the guest form and the server lookup; re-parsed server-side. */
export const orderTrackingSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(4, "Enter the order number from your receipt.")
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, "Order numbers look like DG-240131-0001.")
    .transform(normalizeOrderNumber),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+][0-9\s-]{6,19}$/, "Enter the phone number used on the order."),
});

export type OrderTrackingInput = z.infer<typeof orderTrackingSchema>;

/** The happy path a customer is shown; exceptions hang off it. */
export const TRACKING_JOURNEY = ["pending", "confirmed", "packed", "shipped", "delivered"] as const;

export type TimelineStep = {
  status: string;
  meta: StatusMeta;
  state: "done" | "current" | "upcoming";
};

/**
 * Never throws: an unknown status still renders as a single current step.
 * Exception endings (refused, returned to sender, cancelled, confirmation
 * required) are appended after the journey steps they actually reached.
 */
export function trackingTimeline(value: string): TimelineStep[] {
  const described = describeStatus(value);
  const journey = TRACKING_JOURNEY as readonly string[];
  const index = journey.indexOf(described.status);

  if (index >= 0) {
    return TRACKING_JOURNEY.map((status, position) => ({
      status,
      meta: ORDER_STATUS_META[status],
      state: position < index ? "done" : position === index ? "current" : "upcoming",
    }));
  }

  // A known exception always follows at least a placed order, so it never rewinds past "pending".
  const anchor = described.known
    ? Math.max(journey.indexOf(persistableStatus(described.status as CodStatus)), 0)
    : -1;
  const reached = TRACKING_JOURNEY.slice(0, anchor + 1).map((status): TimelineStep => ({
    status,
    meta: ORDER_STATUS_META[status],
    state: "done",
  }));

  const { label, description, tone, persistable } = described;
  return [...reached, { status: described.status, meta: { label, description, tone, persistable }, state: "current" }];
}
