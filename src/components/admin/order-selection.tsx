"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { BulkActions } from "@/components/admin/bulk-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { isConsequential } from "@/features/admin/bulk-actions";
import { moveOrderStatus } from "@/features/admin/order-actions";
import {
  ORDER_STATUS_META,
  isCodStatus,
  nextStatuses,
  type CodStatus,
} from "@/features/orders/status";

export type SelectableOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  placedAtIso: string;
  placedAtLabel: string;
  customerName: string;
  contactPhone: string;
  paymentLabel: string;
  totalLabel: string;
};

/** Selection lives here, so it lasts exactly as long as this page render. */
export function OrderSelection({
  rows,
  children,
}: {
  rows: readonly SelectableOrderRow[];
  /** The pagination footer, rendered inside the panel as the mockup has it. */
  children?: ReactNode;
}) {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const selected = rows.filter((row) => selectedIds.includes(row.id));
  const allSelected = rows.length > 0 && selected.length === rows.length;

  function toggle(id: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, id] : current.filter((value) => value !== id)));
  }

  return (
    <div className="admin-panel orders-panel">
      <BulkActions
        selected={selected.map((row) => ({ id: row.id, orderNumber: row.orderNumber, status: row.status }))}
        onApplied={() => setSelectedIds([])}
      />

      {rows.length === 0 ? (
        <p className="admin-empty">No orders match this view.</p>
      ) : (
      <div className="admin-table-scroll">
        <table className="admin-table admin-data-table">
          <thead>
            <tr>
              <th scope="col" className="order-select-cell">
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])}
                  />
                  <span className="admin-visually-hidden">Select all on this page</span>
                </label>
              </th>
              <th scope="col">Order</th>
              <th scope="col">Placed</th>
              <th scope="col">Customer</th>
              <th scope="col">Status</th>
              <th scope="col">Payment</th>
              <th scope="col" className="admin-num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-selected={selectedIds.includes(row.id)}>
                <td className="order-select-cell" data-label="Select">
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(event) => toggle(row.id, event.target.checked)}
                    />
                    <span className="admin-visually-hidden">Select {row.orderNumber}</span>
                  </label>
                </td>
                <td className="admin-mono" data-label="Order">
                  <Link href={`/admin/orders/${row.id}`}>{row.orderNumber}</Link>
                </td>
                <td className="admin-mono orders-placed" data-label="Placed">
                  <time dateTime={row.placedAtIso}>{row.placedAtLabel}</time>
                </td>
                <td className="orders-customer" data-label="Customer">
                  {row.customerName}
                  <span className="admin-meta">{row.contactPhone}</span>
                </td>
                <td data-label="Status">
                  <StatusBadge status={row.status} />
                  <RowStatusControl orderId={row.id} status={row.status} />
                </td>
                <td className="orders-payment" data-label="Payment">
                  {row.paymentLabel}
                </td>
                <td className="admin-num" data-label="Total">
                  {row.totalLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {children}
    </div>
  );
}

/**
 * Inline move for a single row. The options come from COD_STATUS_FLOW, so an
 * illegal transition is never offered, and the server action re-derives the
 * current status before writing — this select only saves a trip to the detail
 * page. Consequential targets still ask first.
 */
function RowStatusControl({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!isCodStatus(status)) return null;
  const targets = nextStatuses(status);
  if (targets.length === 0) return null;

  function move(target: CodStatus) {
    if (isConsequential(target) && !window.confirm(`Mark this order ${ORDER_STATUS_META[target].label.toLowerCase()}? Nothing moves it out of that status afterwards.`)) {
      return;
    }
    startTransition(async () => {
      const result = await moveOrderStatus(orderId, target);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Order moved to ${ORDER_STATUS_META[target].label.toLowerCase()}.`);
      router.refresh();
    });
  }

  return (
    <select
      className="row-status-select"
      aria-label="Move this order to another status"
      value=""
      disabled={isPending}
      onChange={(event) => {
        const target = event.target.value;
        event.target.value = "";
        if (isCodStatus(target)) move(target);
      }}
    >
      <option value="">{isPending ? "Updating…" : "Move to…"}</option>
      {targets.map((target) => (
        <option key={target} value={target}>
          {ORDER_STATUS_META[target].label}
        </option>
      ))}
    </select>
  );
}
