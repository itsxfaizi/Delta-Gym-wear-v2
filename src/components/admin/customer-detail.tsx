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
        <h1>{record.name}</h1>
        <p className="admin-hint">
          {record.isGuest
            ? "Guest — these orders were placed without an account, and are grouped by contact phone number."
            : "Account customer."}
        </p>
      </div>

      <div className="customer-summary">
        <section className="admin-panel customer-card" aria-labelledby="customer-contact">
          <h2 id="customer-contact">Contact</h2>
          <dl className="admin-definition">
            <dt>Email</dt>
            <dd>{record.email}</dd>
            <dt>Phone</dt>
            <dd>{record.phone}</dd>
            <dt>City</dt>
            <dd>{record.city}</dd>
          </dl>
        </section>

        <section className="admin-panel customer-card" aria-labelledby="customer-metrics">
          <h2 id="customer-metrics">Cash-on-delivery record</h2>
          <dl className="admin-definition">
            <dt>Orders</dt>
            <dd>{record.orderCount}</dd>
            <dt>Total ordered</dt>
            <dd>{formatMoney(record.totalOrderedAmount, record.currency)}</dd>
            <dt>Delivered</dt>
            <dd>
              {record.deliveredCount} · {formatMoney(record.deliveredAmount, record.currency)}
            </dd>
            <dt>Refused</dt>
            <dd>{record.refusedCount}</dd>
            <dt>Returned to sender</dt>
            <dd>{record.returnedCount}</dd>
            <dt>Cancelled</dt>
            <dd>{record.cancelledCount}</dd>
          </dl>
        </section>

        <section className="admin-panel customer-card" aria-labelledby="customer-risk">
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

      <h2 className="customer-history-heading">Order history</h2>
      <div className="admin-panel admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Placed</th>
              <th scope="col">Status</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {record.orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                </td>
                <td>
                  <time dateTime={order.placedAt.toISOString()}>{formatDateTime(order.placedAt)}</time>
                </td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>{formatMoney(order.totalAmount, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
