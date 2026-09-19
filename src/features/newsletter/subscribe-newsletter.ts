"use server";

import { z } from "zod";

/**
 * Newsletter capture for frame 142:5060. There is no subscribe endpoint, email
 * provider or consent copy approved in this repo, so the action validates the
 * address server-side and then honestly reports that signup is unavailable. It
 * never stores an address and never claims a successful subscription. When a
 * provider is approved, replace the `unavailable` branch with the real call.
 */
export type NewsletterState = {
  readonly status: "idle" | "error" | "unavailable";
  readonly message: string;
};

const newsletterSchema = z.object({
  email: z.email("Enter a valid email address, like name@example.com.").max(320),
});

export async function subscribeToNewsletter(
  _previousState: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = newsletterSchema.safeParse({ email: String(formData.get("email") ?? "").trim() });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  return {
    status: "unavailable",
    message: "Email signup is not live yet, so your address was not saved and you are not subscribed.",
  };
}
