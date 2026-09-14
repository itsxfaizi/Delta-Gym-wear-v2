"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { formatDateTime } from "@/lib/datetime";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { recordCall } from "@/features/admin/order-actions";
import { CALL_OUTCOMES, recordCallAttemptSchema } from "@/features/orders/ops-schemas";
import type { CallAttempt } from "@/server/ops/types";


const OUTCOME_LABELS: Record<(typeof CALL_OUTCOMES)[number], string> = {
  confirmed: "Confirmed",
  no_answer: "No answer",
  invalid_number: "Invalid number",
  customer_cancelled: "Customer cancelled",
  callback_requested: "Callback requested",
};

type CallFormValues = z.input<typeof recordCallAttemptSchema>;

export function CallWorkflow({
  orderId,
  attempts,
  lastAttemptAt,
  nextFollowUpAt,
}: {
  orderId: string;
  attempts: readonly CallAttempt[];
  lastAttemptAt: Date | null;
  nextFollowUpAt: Date | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Append-only and server-confirmed on refresh, so a failed write rolls back
  // to `attempts` on its own when the transition ends.
  const [shown, addOptimistic] = useOptimistic(attempts, (current, attempt: CallAttempt) => [
    ...current,
    attempt,
  ]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CallFormValues, unknown, z.output<typeof recordCallAttemptSchema>>({
    resolver: zodResolver(recordCallAttemptSchema),
    defaultValues: { orderId, outcome: undefined, note: "", nextFollowUpAt: "" },
  });

  function onSubmit(values: z.output<typeof recordCallAttemptSchema>) {
    startTransition(async () => {
      addOptimistic({
        id: "optimistic",
        outcome: values.outcome,
        notedAt: new Date(),
        ...(values.note ? { note: values.note } : {}),
      });
      const result = await recordCall(orderId, values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Call attempt recorded.");
      reset({ orderId, outcome: undefined, note: "", nextFollowUpAt: "" });
      router.refresh();
    });
  }

  return (
    <div className="ops-stack">
      <dl className="ops-meta">
        <dt>Attempts</dt>
        <dd>{shown.length}</dd>
        <dt>Last attempt</dt>
        <dd>
          {lastAttemptAt ? (
            <time dateTime={lastAttemptAt.toISOString()}>{formatDateTime(lastAttemptAt)}</time>
          ) : (
            "Never called"
          )}
        </dd>
        <dt>Next follow-up</dt>
        <dd>
          {nextFollowUpAt ? (
            <time dateTime={nextFollowUpAt.toISOString()}>{formatDateTime(nextFollowUpAt)}</time>
          ) : (
            "None scheduled"
          )}
        </dd>
      </dl>

      <form className="admin-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="call-outcome">Outcome</label>
            <select
              id="call-outcome"
              defaultValue=""
              aria-invalid={errors.outcome ? "true" : "false"}
              {...register("outcome")}
            >
              <option value="" disabled>
                Choose an outcome
              </option>
              {CALL_OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {OUTCOME_LABELS[outcome]}
                </option>
              ))}
            </select>
            {errors.outcome ? (
              <span className="admin-error" role="alert">
                Choose what happened on the call.
              </span>
            ) : null}
          </div>

          <div className="admin-field">
            <label htmlFor="call-follow-up">Next follow-up (optional)</label>
            <input
              id="call-follow-up"
              type="datetime-local"
              aria-invalid={errors.nextFollowUpAt ? "true" : "false"}
              {...register("nextFollowUpAt", { setValueAs: (value: string) => value || null })}
            />
            {errors.nextFollowUpAt ? (
              <span className="admin-error" role="alert">
                {errors.nextFollowUpAt.message}
              </span>
            ) : null}
          </div>
        </div>

        <div className="admin-field admin-field--wide">
          <label htmlFor="call-note">Note (optional)</label>
          <textarea id="call-note" rows={2} {...register("note")} />
          {errors.note ? (
            <span className="admin-error" role="alert">
              {errors.note.message}
            </span>
          ) : null}
        </div>

        <div className="admin-actions">
          <button className="admin-button admin-button--primary" type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Record attempt"}
          </button>
        </div>
      </form>

      <h3 className="ops-when">Attempt history</h3>
      {shown.length === 0 ? (
        <p className="admin-empty">No calls yet.</p>
      ) : (
        <ol className="ops-list">
          {shown.map((attempt, index) => (
            <li key={attempt.id === "optimistic" ? `optimistic-${index}` : attempt.id}>
              <span className="ops-when">
                <time dateTime={attempt.notedAt.toISOString()}>{formatDateTime(attempt.notedAt)}</time>
              </span>
              <p>
                <strong>{OUTCOME_LABELS[attempt.outcome]}</strong>
                {attempt.note ? ` — ${attempt.note}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
