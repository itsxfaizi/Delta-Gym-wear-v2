import { describeStatus } from "@/features/orders/status";

/**
 * The one order status badge, shared by the dashboard, order list, order detail,
 * timeline and customers screens. Label and tone come from ORDER_STATUS_META via
 * describeStatus, which never throws on an unknown or legacy status.
 */
export function StatusBadge({ status }: { status: string }) {
  const meta = describeStatus(status);
  return (
    <span className="admin-status" data-status={status} data-tone={meta.tone}>
      {meta.label}
    </span>
  );
}
