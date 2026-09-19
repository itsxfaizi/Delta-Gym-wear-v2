"use client";

import { useActionState, useId } from "react";

import { subscribeToNewsletter, type NewsletterState } from "@/features/newsletter/subscribe-newsletter";

const IDLE_STATE: NewsletterState = { status: "idle", message: "" };

/**
 * Frame 142:5060 newsletter capture, measured off the authoritative prototype
 * recording (f930): one flush-joined control, 710x52 CSS px, a 509px dark field
 * butted straight onto a 201px amber SUBSCRIBE button with no radius and no gap.
 *
 * Deviations from the recording, both accessibility-driven:
 * - the recording has a centred placeholder and no label; a visible label is
 *   rendered above the field instead (a placeholder is not an accessible name).
 * - the recording never exercises focus/error/pending, so those states are
 *   authored here rather than sourced.
 *
 * The controls stay enabled and focusable. Validation runs natively in the
 * browser and again in `subscribeToNewsletter` on the server; because no
 * subscribe endpoint exists, a valid address returns an honest "not live yet"
 * status. Nothing is stored and success is never claimed.
 */
export function NewsletterForm({ idPrefix = "newsletter" }: { idPrefix?: string }) {
  const reactId = useId();
  const inputId = `${idPrefix}-email-${reactId}`;
  const statusId = `${idPrefix}-status-${reactId}`;
  const [state, formAction, isPending] = useActionState(subscribeToNewsletter, IDLE_STATE);

  return (
    <form action={formAction} className="w-full max-w-[710px] text-start">
      <label
        htmlFor={inputId}
        className="mb-2 block text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase"
      >
        Email address
      </label>
      <div className="grid min-h-[52px] grid-cols-1 bg-primary text-primary-foreground sm:grid-cols-[1fr_201px]">
        <input
          id={inputId}
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          placeholder="info@deltagymwear.com"
          aria-invalid={state.status === "error"}
          aria-describedby={statusId}
          className="min-h-[52px] w-full border-0 bg-transparent px-6 text-primary-foreground placeholder:text-[var(--color-on-invert-subtle)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          className="min-h-[52px] bg-accent px-6 text-xs font-bold tracking-[0.08em] text-foreground uppercase focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
        >
          {isPending ? "Checking…" : "Subscribe"}
        </button>
      </div>
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={`mt-3 min-h-[1.5rem] text-sm ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
