import { z } from "zod";

import { COD_STATUSES } from "./status";

/** Call outcomes, mirrored by CallOutcome in @/server/ops/types. */
export const CALL_OUTCOMES = [
  "confirmed",
  "no_answer",
  "invalid_number",
  "customer_cancelled",
  "callback_requested",
] as const;

// Not .uuid(): with no DATABASE_URL the admin pages render derived fixture ids.
// The real guard is the order lookup in the server action.
const orderIdSchema = z.string().trim().min(1).max(128);

const noteSchema = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((value) => value || null);

/** Future-dated only: a follow-up in the past is a mis-typed year, not a plan. */
const followUpAtSchema = z.coerce
  .date()
  .refine((value) => value.getTime() > Date.now(), { message: "Pick a time in the future." });

export const callOutcomeSchema = z.enum(CALL_OUTCOMES);

export const recordCallAttemptSchema = z.object({
  orderId: orderIdSchema,
  outcome: callOutcomeSchema,
  note: noteSchema,
  nextFollowUpAt: followUpAtSchema.nullish().transform((value) => value ?? null),
});

export const followUpSchema = z.object({
  orderId: orderIdSchema,
  nextFollowUpAt: followUpAtSchema.nullish().transform((value) => value ?? null),
});

export const internalNoteSchema = z.object({
  orderId: orderIdSchema,
  body: z.string().trim().min(1, "Write something first.").max(2000),
});

export const setCourierSchema = z.object({
  orderId: orderIdSchema,
  courier: z.string().trim().min(2).max(80),
  // Pakistani CN numbers run ~8-20 chars; allow letters, digits and dashes.
  trackingNumber: z
    .string()
    .trim()
    .min(6, "A CN number is at least 6 characters.")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, digits and dashes only."),
  // An untouched form input arrives as "", which means "no URL", not "bad URL".
  trackingUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z
      .string()
      .trim()
      .url("Enter a full tracking URL, including https://.")
      .max(2000)
      .refine((value) => /^https?:\/\//i.test(value), {
        message: "The URL must start with http:// or https://.",
      })
      .nullish()
      .transform((value) => value ?? null),
  ),
  dispatchedAt: z.coerce.date().nullish().transform((value) => value ?? null),
});

export const setOpsStatusSchema = z.object({
  orderId: orderIdSchema,
  status: z.enum(COD_STATUSES),
});

export type CallOutcomeInput = z.infer<typeof callOutcomeSchema>;
export type RecordCallAttemptInput = z.infer<typeof recordCallAttemptSchema>;
export type FollowUpInput = z.infer<typeof followUpSchema>;
export type InternalNoteInput = z.infer<typeof internalNoteSchema>;
export type SetCourierInput = z.infer<typeof setCourierSchema>;
export type SetOpsStatusInput = z.infer<typeof setOpsStatusSchema>;
