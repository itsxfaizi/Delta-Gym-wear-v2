import type { CSSProperties } from "react";
import Link from "next/link";

import { ChartCard } from "@/components/admin/chart-card";
import { RevenueOrdersChart } from "@/components/admin/charts/revenue-orders-chart";
import { KpiCard } from "@/components/admin/kpi-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { StockAdjustControl } from "@/components/admin/stock-adjust-control";
import {
  averageOrderValue,
  bucketOrdersByDay,
  countAwaitingConfirmation,
  countCodStatuses,
  deliveryOutcomes,
  percentChange,
  splitByPeriod,
  sumOrderRevenue,
  topSellingProducts,
} from "@/features/admin/dashboard";
import { COD_STATUSES, ORDER_STATUS_META } from "@/features/orders/status";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/money";
import { getAdminDashboard } from "@/server/admin/queries";

import "@/styles/admin-dashboard.css";

const PERCENT = new Intl.NumberFormat("en-PK", { style: "percent", maximumFractionDigits: 1 });
const COUNT = new Intl.NumberFormat("en-PK");

const RANGES = [7, 30, 90] as const;
const DEFAULT_RANGE = 30;

const rate = (value: number | null) => (value === null ? "—" : PERCENT.format(value));

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Number.parseInt(Array.isArray(params.range) ? (params.range[0] ?? "") : (params.range ?? ""), 10);
  const range = (RANGES as readonly number[]).includes(raw) ? raw : DEFAULT_RANGE;

  const { windowDays, windowOrders, soldItems, lowStock, recentOrders, awaitingConfirmation } =
    await getAdminDashboard(range);

  const { current, prior } = splitByPeriod(windowOrders, windowDays);
  const currency = recentOrders[0]?.currency ?? DEFAULT_CURRENCY;

  const revenue = sumOrderRevenue(current);
  const outcomes = deliveryOutcomes(current);
  const buckets = bucketOrdersByDay(current, windowDays);
  const statusCounts = countCodStatuses(current);
  const pipeline = COD_STATUSES.filter((status) => statusCounts[status] > 0).map((status) => ({
    status,
    label: ORDER_STATUS_META[status].label,
    count: statusCounts[status],
  }));
  const topProducts = topSellingProducts(soldItems);
  const topUnits = topProducts[0]?.quantity ?? 0;
  const pendingCalls = countAwaitingConfirmation(current);
  const priorCaption = `vs prev ${windowDays}d`;

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Operations</h1>
          <p className="admin-hint">
            Cash-on-delivery, last {windowDays} days · {COUNT.format(current.length)} orders
          </p>
        </div>
        <div className="admin-actions">
          <div className="admin-tabs" role="group" aria-label="Reporting window">
            {RANGES.map((days) => (
              <Link
                key={days}
                className="admin-tab"
                href={days === DEFAULT_RANGE ? "/admin" : `/admin?range=${days}`}
                aria-current={days === range ? "page" : undefined}
              >
                {days}D
              </Link>
            ))}
          </div>
          <Link className="admin-button admin-button--primary" href="/admin/products/new">
            New product
          </Link>
        </div>
      </div>

      <section aria-label="Key figures">
        <div className="kpi-grid">
          <KpiCard
            label="Revenue"
            value={formatMoney(revenue, currency)}
            tone="accent"
            trend={{ change: percentChange(revenue, sumOrderRevenue(prior)), caption: priorCaption }}
            series={buckets.map((bucket) => bucket.revenue)}
          />
          <KpiCard
            label="Orders"
            value={COUNT.format(current.length)}
            href="/admin/orders"
            trend={{ change: percentChange(current.length, prior.length), caption: priorCaption }}
            series={buckets.map((bucket) => bucket.orders)}
          />
          <KpiCard
            label="Average order"
            value={formatMoney(averageOrderValue(current), currency)}
            trend={{
              change: percentChange(averageOrderValue(current), averageOrderValue(prior)),
              caption: priorCaption,
            }}
          />
          <KpiCard
            label="Delivery rate"
            value={rate(outcomes.deliveryRate)}
            hint={
              outcomes.settled === 0
                ? "No parcel has settled yet"
                : `${COUNT.format(outcomes.delivered)} of ${COUNT.format(outcomes.settled)} settled`
            }
          />
          <KpiCard
            label="Refused / returned"
            value={rate(outcomes.refusalRate)}
            tone="danger"
            hint={outcomes.settled === 0 ? "No parcel has settled yet" : `${COUNT.format(outcomes.failed)} parcels`}
          />
          <KpiCard
            label="Awaiting call"
            value={COUNT.format(pendingCalls)}
            href="/admin/orders?status=pending"
            tone="accent"
            hint="Call before packing"
          />
        </div>
      </section>

      <div className="dash-row">
        <ChartCard
          title="Revenue and orders"
          description={`Daily, last ${windowDays} days`}
          isEmpty={current.length === 0}
          emptyMessage="No orders in this window, so there is nothing to plot yet."
          action={
            <p className="dash-legend">
              <span>
                <span className="dash-legend-rule" aria-hidden />
                Revenue
              </span>
              <span>
                <span className="dash-legend-square" aria-hidden />
                Orders
              </span>
            </p>
          }
        >
          <RevenueOrdersChart
            data={buckets}
            summary={`Revenue and order count per day: ${formatMoney(revenue, currency)} across ${COUNT.format(current.length)} orders.`}
          />
        </ChartCard>

        <section className="admin-panel">
          <div className="dash-head">
            <h2>Order pipeline</h2>
            <p className="admin-hint">Where this window&rsquo;s orders stand</p>
          </div>
          {pipeline.length === 0 ? (
            <p className="admin-empty">No orders in this window yet.</p>
          ) : (
            <>
              <div
                className="dash-pipeline-bar"
                role="img"
                aria-label={pipeline.map((slice) => `${slice.label}: ${slice.count}`).join(", ")}
              >
                {pipeline.map((slice) => (
                  <span
                    key={slice.status}
                    data-status={slice.status}
                    style={{ flexGrow: slice.count }}
                  />
                ))}
              </div>
              <dl className="dash-pipeline-legend">
                {pipeline.map((slice) => (
                  <div key={slice.status}>
                    <dt>
                      <span className="dash-swatch" data-status={slice.status} aria-hidden />
                      {slice.label}
                    </dt>
                    <dd className="admin-num">{COUNT.format(slice.count)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
      </div>

      <div className="dash-row dash-row--split">
        <section className="admin-panel">
          <div className="dash-head">
            <h2>Top products</h2>
            <p className="admin-hint">Units sold, last {windowDays * 2} days</p>
          </div>
          {topProducts.length === 0 ? (
            <p className="admin-empty">Nothing has sold in this window.</p>
          ) : (
            <ul className="dash-bars">
              {topProducts.map((product, rank) => (
                <li key={product.productTitle} data-rank={Math.min(rank, 3)}>
                  <p className="dash-bar-head">
                    <span>{product.productTitle}</span>
                    <span className="admin-num">
                      {COUNT.format(product.quantity)} units · {formatMoney(product.revenue, currency)}
                    </span>
                  </p>
                  <span
                    className="dash-bar-track"
                    style={{ "--dash-bar": `${topUnits === 0 ? 0 : (product.quantity / topUnits) * 100}%` } as CSSProperties}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-panel">
          <h2>Recent orders</h2>
          {recentOrders.length === 0 ? (
            <p className="admin-empty">No orders yet.</p>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table admin-data-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col">City</th>
                    <th scope="col">Status</th>
                    <th className="admin-num" scope="col">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="admin-mono" data-label="Order">
                        <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                      </td>
                      <td data-label="Customer">{order.shippingAddress.fullName}</td>
                      <td className="dash-cell-muted" data-label="City">
                        {order.shippingAddress.city}
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
          )}
        </section>
      </div>

      <div className="dash-row dash-row--queues">
        <section className="admin-panel">
          <h2>
            Call desk
            {pendingCalls > 0 ? (
              // The list below is capped at 8 rows; the chip reports the whole queue.
              <span className="dash-chip dash-chip--solid">{COUNT.format(pendingCalls)}</span>
            ) : null}
          </h2>
          {awaitingConfirmation.length === 0 ? (
            <p className="admin-empty">Every order has been called.</p>
          ) : (
            <ul className="dash-queue">
              {awaitingConfirmation.map((order) => (
                <li key={order.id}>
                  <Link className="admin-mono" href={`/admin/orders/${order.id}`}>
                    {order.orderNumber}
                  </Link>
                  <span className="dash-queue-figure">{formatMoney(order.totalAmount, order.currency)}</span>
                  <span className="admin-hint dash-queue-meta">
                    {order.shippingAddress.fullName} · {order.contactPhone}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-panel dash-panel--danger">
          <h2>
            Low stock
            {lowStock.length > 0 ? (
              <span className="dash-chip dash-chip--danger">{COUNT.format(lowStock.length)}</span>
            ) : null}
          </h2>
          {lowStock.length === 0 ? (
            <p className="admin-empty">Nothing is running low.</p>
          ) : (
            <ul className="dash-queue dash-queue--stock">
              {lowStock.map((variant) => (
                <li key={variant.id}>
                  <Link href={`/admin/products/${variant.productId}`}>{variant.productTitle}</Link>
                  <span className="dash-queue-figure">{variant.stockQuantity}</span>
                  <StockAdjustControl
                    variantId={variant.id}
                    sku={variant.sku}
                    stockQuantity={variant.stockQuantity}
                  />
                  <span className="admin-meta">{variant.sku}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </>
  );
}
