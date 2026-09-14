import Link from "next/link";
import { formatDate } from "@/lib/datetime";

import type { CustomerRecord } from "@/features/admin/customers";
import { formatMoney } from "@/lib/money";


const RISK_LABEL = {
  unknown: "Not enough history",
  ok: "No pattern",
  watch: "Watch",
  high: "High failure rate",
} as const;

export function RiskSignalCell({ record }: { record: CustomerRecord }) {
  return (
    <>
      <span className="customer-risk" data-level={record.risk.level}>
        {RISK_LABEL[record.risk.level]}
      </span>
      <span className="customer-risk-reason">{record.risk.reason}</span>
    </>
  );
}

export function CustomerTable({ records }: { records: readonly CustomerRecord[] }) {
  return (
    <div className="admin-panel admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Customer</th>
            <th scope="col">Orders</th>
            <th scope="col">Ordered</th>
            <th scope="col">Delivered</th>
            <th scope="col">Refused / returned / cancelled</th>
            <th scope="col">Last order</th>
            <th scope="col">COD signal</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.key}>
              <td className="admin-cell-wrap">
                <Link href={`/admin/customers/${encodeURIComponent(record.key)}`}>{record.name}</Link>
                {record.isGuest ? <span className="customer-tag">Guest</span> : null}
                <br />
                {record.email}
                <br />
                {record.phone}
              </td>
              <td>{record.orderCount}</td>
              <td>{formatMoney(record.totalOrderedAmount, record.currency)}</td>
              <td>
                {record.deliveredCount}
                <br />
                <span className="admin-hint">{formatMoney(record.deliveredAmount, record.currency)}</span>
              </td>
              <td>
                {record.refusedCount} / {record.returnedCount} / {record.cancelledCount}
              </td>
              <td>
                {record.lastOrderAt ? (
                  <time dateTime={record.lastOrderAt.toISOString()}>{formatDate(record.lastOrderAt)}</time>
                ) : (
                  "—"
                )}
              </td>
              <td className="admin-cell-wrap">
                <RiskSignalCell record={record} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
