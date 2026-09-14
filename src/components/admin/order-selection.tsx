"use client";

import Link from "next/link";
import { useState } from "react";

import { BulkActions } from "@/components/admin/bulk-actions";
import { StatusBadge } from "@/components/admin/status-badge";

export type SelectableOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  placedAtIso: string;
  placedAtLabel: string;
  customerName: string;
  contactPhone: string;
  paymentStatus: string;
  totalLabel: string;
};

/** Selection lives here, so it lasts exactly as long as this page render. */
export function OrderSelection({ rows }: { rows: readonly SelectableOrderRow[] }) {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const selected = rows.filter((row) => selectedIds.includes(row.id));
  const allSelected = rows.length > 0 && selected.length === rows.length;

  function toggle(id: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, id] : current.filter((value) => value !== id)));
  }

  return (
    <>
      <BulkActions
        selected={selected.map((row) => ({ id: row.id, orderNumber: row.orderNumber, status: row.status }))}
        onApplied={() => setSelectedIds([])}
      />

      <div className="admin-panel admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col" className="order-select-cell">
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])}
                  />
                  <span>Select all on this page</span>
                </label>
              </th>
              <th scope="col">Order</th>
              <th scope="col">Placed</th>
              <th scope="col">Customer</th>
              <th scope="col">Status</th>
              <th scope="col">Payment</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-selected={selectedIds.includes(row.id)}>
                <td className="order-select-cell">
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(event) => toggle(row.id, event.target.checked)}
                    />
                    <span className="order-select-label">Select {row.orderNumber}</span>
                  </label>
                </td>
                <td>
                  <Link href={`/admin/orders/${row.id}`}>{row.orderNumber}</Link>
                </td>
                <td>
                  <time dateTime={row.placedAtIso}>{row.placedAtLabel}</time>
                </td>
                <td className="admin-cell-wrap">
                  {row.customerName}
                  <br />
                  {row.contactPhone}
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>{row.paymentStatus}</td>
                <td>{row.totalLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
