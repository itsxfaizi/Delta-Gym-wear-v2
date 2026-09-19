import Link from "next/link";
import { formatDate } from "@/lib/datetime";

import type { CustomerRecord } from "@/features/admin/customers";
import { formatMoney } from "@/lib/money";

const RISK_LABEL = {
  unknown: "Unknown",
  ok: "OK",
  watch: "Watch",
  high: "High",
} as const;

/** The compact badge: short level + the failure share it was read from. */
export function RiskBadge({ record }: { record: CustomerRecord }) {
  return (
    <span className="customer-signal">
      <span className="customer-risk" data-level={record.risk.level}>
        {RISK_LABEL[record.risk.level]}
      </span>
      <span className="customer-risk-ratio">
        {record.risk.level === "unknown" ? "—" : `${Math.round(record.risk.ratio * 100)}%`}
      </span>
    </span>
  );
}

export function RiskSignalCell({ record }: { record: CustomerRecord }) {
  return (
    <>
      <RiskBadge record={record} />
      <span className="customer-risk-reason">{record.risk.reason}</span>
    </>
  );
}

export function CustomerTable({ records }: { records: readonly CustomerRecord[] }) {
  return (
    <div className="admin-panel admin-table-scroll">
      <table className="admin-table admin-data-table customer-table customer-table--list">
        <thead>
          <tr>
            <th scope="col">Customer</th>
            <th className="admin-num" scope="col">
              Orders
            </th>
            <th className="admin-num" scope="col">
              Ordered
            </th>
            <th className="admin-num" scope="col">
              Delivered
            </th>
            <th className="admin-num" scope="col">
              Refused / returned
            </th>
            <th scope="col">Last order</th>
            <th scope="col">COD signal</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.key}>
              <td className="admin-cell-wrap" data-label="Customer">
                <Link href={`/admin/customers/${encodeURIComponent(record.key)}`}>{record.name}</Link>
                {record.isGuest ? <span className="customer-tag">Guest</span> : null}
                <span className="admin-meta">{record.phone}</span>
              </td>
              <td className="admin-num" data-label="Orders">
                {record.orderCount}
              </td>
              <td className="admin-num" data-label="Ordered">
                {formatMoney(record.totalOrderedAmount, record.currency)}
              </td>
              <td className="admin-num" data-label="Delivered">
                {record.deliveredCount}
              </td>
              <td className="admin-num" data-failed={record.failedCount > 0} data-label="Refused / returned / cancelled">
                {record.failedCount}
              </td>
              <td className="admin-mono customer-last" data-label="Last order">
                {record.lastOrderAt ? (
                  <time dateTime={record.lastOrderAt.toISOString()}>{formatDate(record.lastOrderAt)}</time>
                ) : (
                  "—"
                )}
              </td>
              <td data-label="COD signal">
                <RiskBadge record={record} />
                <span className="sr-only">{record.risk.reason}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
