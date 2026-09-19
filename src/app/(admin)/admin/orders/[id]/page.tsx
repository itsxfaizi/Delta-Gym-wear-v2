import { notFound } from "next/navigation";
import { formatLongDateTime } from "@/lib/datetime";

import { CallWorkflow } from "@/components/admin/call-workflow";
import { CourierForm } from "@/components/admin/courier-form";
import { InternalNotes } from "@/components/admin/internal-notes";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatMoney } from "@/lib/money";
import { getOrderOps } from "@/server/ops/order-ops";
import { OrdersDatabaseUnavailableError, getOrderById } from "@/server/orders/queries";

import "../../../../../styles/admin-ops.css";

/** Same cash-on-delivery wording the list uses for its Payment column. */
const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Pending on delivery",
  paid: "Collected",
  refunded: "Refunded",
};


export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await getOrderById(id).then(
    (found) => ({ order: found, databaseUnavailable: false }),
    (error: unknown) => {
      if (error instanceof OrdersDatabaseUnavailableError) {
        return { order: null, databaseUnavailable: true };
      }
      throw error;
    },
  );
  const { order, databaseUnavailable } = loaded;

  // No DATABASE_URL means every order reads as null: say so instead of 404ing.
  if (!order) {
    if (!databaseUnavailable) notFound();
    return (
      <>
        <div className="admin-header">
          <div>
            <h1>Order</h1>
            <p className="admin-hint admin-mono">{id}</p>
          </div>
        </div>
        <section className="admin-panel">
          <h2>Order unavailable</h2>
          <p className="admin-empty">
            The orders database is not configured in this environment, so this order cannot be
            loaded. Operations tools appear once it is connected.
          </p>
        </section>
      </>
    );
  }

  const ops = await getOrderOps(order.id);
  const status = ops.opsStatus ?? order.status;
  const address = order.shippingAddress;
  const money = (amount: number) => formatMoney(amount, order.currency);

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>{order.orderNumber}</h1>
          <p className="admin-hint">
            Placed <time dateTime={order.placedAt.toISOString()}>{formatLongDateTime(order.placedAt)}</time>{" "}
            · {money(order.totalAmount)}
          </p>
        </div>
        <div className="admin-actions">
          <StatusBadge status={status} />
        </div>
      </div>

      <section className="admin-panel">
        <h2>Fulfilment</h2>
        <OrderStatusControl orderId={order.id} status={status} />
      </section>

      <div className="admin-columns">
        <section className="admin-panel">
          <h2>Confirmation call</h2>
          <CallWorkflow
            orderId={order.id}
            attempts={ops.callAttempts}
            lastAttemptAt={ops.lastAttemptAt}
            nextFollowUpAt={ops.nextFollowUpAt}
          />
        </section>

        <section className="admin-panel">
          <h2>Courier &amp; tracking</h2>
          <CourierForm
            orderId={order.id}
            courier={ops.courier}
            trackingNumber={ops.trackingNumber}
            trackingUrl={ops.trackingUrl}
            dispatchedAt={ops.dispatchedAt}
          />
        </section>
      </div>

      <div className="admin-columns">
        <section className="admin-panel">
          <h2>Timeline</h2>
          <OrderTimeline
            placedAt={order.placedAt}
            status={status}
            attempts={ops.callAttempts}
            dispatchedAt={ops.dispatchedAt}
            courier={ops.courier}
            trackingNumber={ops.trackingNumber}
            nextFollowUpAt={ops.nextFollowUpAt}
          />
        </section>

        <section className="admin-panel ops-internal">
          <h2>Internal notes</h2>
          <InternalNotes orderId={order.id} notes={ops.internalNotes} />
        </section>
      </div>

      <div className="admin-columns">
        <section className="admin-panel">
          <h2>Shipping snapshot</h2>
          <address className="admin-definition">
            {address.fullName}
            <br />
            {address.line1}
            {address.line2 ? <>, {address.line2}</> : null}
            <br />
            {address.city}, {address.province}
            {address.postalCode ? ` ${address.postalCode}` : ""}
            <br />
            {address.country}
            <span className="admin-meta">{address.phone}</span>
          </address>
        </section>

        <section className="admin-panel">
          <h2>Order</h2>
          <dl className="admin-definition">
            <dt>Placed</dt>
            <dd>
              <time dateTime={order.placedAt.toISOString()}>{formatLongDateTime(order.placedAt)}</time>
            </dd>
            <dt>Contact</dt>
            <dd>
              {order.contactEmail}
              <span className="admin-meta">{order.contactPhone}</span>
            </dd>
            <dt>Payment</dt>
            <dd>
              {order.paymentMethod.toUpperCase()} · {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
            </dd>
            {order.notes ? (
              <>
                <dt>Customer notes</dt>
                <dd>{order.notes}</dd>
              </>
            ) : null}
          </dl>
        </section>
      </div>

      <section className="admin-panel admin-table-scroll">
        <h2>Items</h2>
        <table className="admin-table admin-data-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">SKU</th>
              <th scope="col" className="admin-num">
                Unit
              </th>
              <th scope="col" className="admin-num">
                Qty
              </th>
              <th scope="col" className="admin-num">
                Line total
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="admin-cell-wrap" data-label="Product">
                  {item.productTitle}
                  {item.variantLabel ? <span className="admin-meta">{item.variantLabel}</span> : null}
                </td>
                <td className="admin-mono" data-label="SKU">
                  {item.sku}
                </td>
                <td className="admin-num" data-label="Unit">
                  {money(item.unitPriceAmount)}
                </td>
                <td className="admin-num" data-label="Qty">
                  {item.quantity}
                </td>
                <td className="admin-num" data-label="Line total">
                  {money(item.lineTotalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={4} scope="row">
                Subtotal
              </th>
              <td className="admin-num" data-label="Subtotal">
                {money(order.subtotalAmount)}
              </td>
            </tr>
            <tr>
              <th colSpan={4} scope="row">
                Shipping
              </th>
              <td className="admin-num" data-label="Shipping">
                {money(order.shippingAmount)}
              </td>
            </tr>
            <tr>
              <th colSpan={4} scope="row">
                Total
              </th>
              <td className="admin-num" data-label="Total">
                {money(order.totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
    </>
  );
}
