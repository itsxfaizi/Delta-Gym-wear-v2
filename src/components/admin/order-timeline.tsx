import { StatusBadge } from "./status-badge";
import { formatDateTime } from "@/lib/datetime";
import type { CallAttempt } from "@/server/ops/types";


const OUTCOME_LABELS: Record<CallAttempt["outcome"], string> = {
  confirmed: "Confirmed on the phone",
  no_answer: "No answer",
  invalid_number: "Invalid number",
  customer_cancelled: "Customer cancelled",
  callback_requested: "Callback requested",
};

type Event = { at: Date; title: string; detail?: string };

/**
 * One chronological view of everything ops knows. Status *history* is not stored
 * yet, so the current status closes the list rather than appearing per change.
 */
export function OrderTimeline({
  placedAt,
  status,
  attempts,
  dispatchedAt,
  courier,
  trackingNumber,
  nextFollowUpAt,
}: {
  placedAt: Date;
  status: string;
  attempts: readonly CallAttempt[];
  dispatchedAt?: Date;
  courier?: string;
  trackingNumber?: string;
  nextFollowUpAt: Date | null;
}) {
  const events: Event[] = [
    { at: placedAt, title: "Order placed" },
    ...attempts.map((attempt) => ({
      at: attempt.notedAt,
      title: `Call — ${OUTCOME_LABELS[attempt.outcome]}`,
      ...(attempt.note ? { detail: attempt.note } : {}),
    })),
  ];

  if (dispatchedAt) {
    events.push({
      at: dispatchedAt,
      title: "Dispatched",
      detail: [courier, trackingNumber].filter(Boolean).join(" · ") || undefined,
    });
  }
  if (nextFollowUpAt) {
    events.push({ at: nextFollowUpAt, title: "Follow-up due" });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <ol className="ops-timeline">
      {events.map((event) => (
        <li key={`${event.title}-${event.at.toISOString()}`}>
          <span className="ops-when">
            <time dateTime={event.at.toISOString()}>{formatDateTime(event.at)}</time>
          </span>
          <strong>{event.title}</strong>
          {event.detail ? <span>{event.detail}</span> : null}
        </li>
      ))}
      <li>
        <span className="ops-when">Now</span>
        <StatusBadge status={status} />
      </li>
    </ol>
  );
}
