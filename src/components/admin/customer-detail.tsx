import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";

import { RiskSignalCell } from "@/components/admin/customer-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { RISK_RULE_TEXT, type CustomerRecord } from "@/features/admin/customers";
import { formatMoney } from "@/lib/money";

/** Every distinct shipping address this customer has used, newest first. */
function addresses(record: CustomerRecord) {
  const seen = new Map<string, CustomerRecord["orders"][number]["shippingAddress"]>();
  for (const order of record.orders) {
    const address = order.shippingAddress;
    const key = [address.line1, address.line2, address.city, address.province].join("|");
    if (!seen.has(key)) seen.set(key, address);
  }
  return [...seen.entries()];
}

export function CustomerDetail({ record }: { record: CustomerRecord }) {
  return (
    <>
      <div className="admin-header">
        <div>
          <h1>{record.name}</h1>
          <p className="admin-hint">
            {record.isGuest
              ? "Guest — these orders were placed without an account, and are grouped by contact phone number."
              : "Account customer."}
          </p>
        </div>
      </div>

      <div className="admin-columns customer-summary">
        <section className="admin-panel" aria-labelledby="customer-contact">
          <h2 id="customer-contact">Contact</h2>
          <dl className="admin-definition">
            <dt>Email</dt>
            <dd className="customer-value">{record.email}</dd>
            <dt>Phone</dt>
            <dd className="customer-value">{record.phone}</dd>
            <dt>City</dt>
            <dd>{record.city}</dd>
          </dl>
        </section>

        <section className="admin-panel" aria-labelledby="customer-metrics">
          <h2 id="customer-metrics">Cash-on-delivery record</h2>
          <dl className="admin-definition">
            <dt>Orders</dt>
            <dd className="customer-value">{record.orderCount}</dd>
            <dt>Total ordered</dt>
            <dd className="customer-value">{formatMoney(record.totalOrderedAmount, record.currency)}</dd>
            <dt>Delivered</dt>
            <dd className="customer-value">
              {record.deliveredCount} · {formatMoney(record.deliveredAmount, record.currency)}
            </dd>
            <dt>Refused</dt>
            <dd className="customer-value">{record.refusedCount}</dd>
            <dt>Returned to sender</dt>
            <dd className="customer-value">{record.returnedCount}</dd>
            <dt>Cancelled</dt>
            <dd className="customer-value">{record.cancelledCount}</dd>
          </dl>
        </section>

        <section className="admin-panel" aria-labelledby="customer-risk">
          <h2 id="customer-risk">COD signal</h2>
          <p className="customer-risk-cell">
            <RiskSignalCell record={record} />
          </p>
          <p className="admin-hint">{RISK_RULE_TEXT}</p>
        </section>
      </div>

      <section className="admin-panel customer-card" aria-labelledby="customer-addresses">
        <h2 id="customer-addresses">Addresses used</h2>
        <ul className="customer-addresses">
          {addresses(record).map(([key, address]) => (
            <li key={key}>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.province}
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-panel" aria-labelledby="customer-history">
        <h2 id="customer-history">Order history</h2>
        <div className="admin-table-scroll">
          <table className="admin-table admin-data-table customer-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Placed</th>
                <th scope="col">Status</th>
                <th className="admin-num" scope="col">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {record.orders.map((order) => (
                <tr key={order.id}>
                  <td className="admin-mono" data-label="Order">
                    <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                  </td>
                  <td className="admin-mono customer-last" data-label="Placed">
                    <time dateTime={order.placedAt.toISOString()}>{formatDateTime(order.placedAt)}</time>
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="admin-num" data-label="Total">
                    {formatMoney(order.totalAmount, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
