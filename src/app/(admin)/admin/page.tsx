import { AlertTriangle, PackageSearch, PhoneCall } from "lucide-react";
import { formatDate } from "@/lib/datetime";
import Link from "next/link";

import { ChartCard } from "@/components/admin/chart-card";
import { DeliveryTrendChart } from "@/components/admin/charts/delivery-trend-chart";
import { RevenueOrdersChart } from "@/components/admin/charts/revenue-orders-chart";
import { StatusDistributionChart } from "@/components/admin/charts/status-distribution-chart";
import { TopProductsChart } from "@/components/admin/charts/top-products-chart";
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

const PERCENT = new Intl.NumberFormat("en-PK", { style: "percent", maximumFractionDigits: 1 });
const COUNT = new Intl.NumberFormat("en-PK");

const rate = (value: number | null) => (value === null ? "—" : PERCENT.format(value));

export default async function AdminDashboardPage() {
  const {
    windowDays,
    windowOrders,
    soldItems,
    lowStock,
    recentOrders,
    awaitingConfirmation,
    missingTracking,
    productCount,
    customerCount,
  } = await getAdminDashboard();

  const { current, prior } = splitByPeriod(windowOrders, windowDays);
  const currency = recentOrders[0]?.currency ?? DEFAULT_CURRENCY;

  const revenue = sumOrderRevenue(current);
  const outcomes = deliveryOutcomes(current);
  const buckets = bucketOrdersByDay(current, windowDays);
  const statusCounts = countCodStatuses(current);
  const statusSlices = COD_STATUSES.filter((status) => statusCounts[status] > 0).map((status) => ({
    label: ORDER_STATUS_META[status].label,
    count: statusCounts[status],
    tone: ORDER_STATUS_META[status].tone,
  }));
  const topProducts = topSellingProducts(soldItems);
  const pendingCalls = countAwaitingConfirmation(current);
  const priorCaption = `vs previous ${windowDays} days`;

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Dashboard</h1>
          <p className="admin-hint">
            Cash-on-delivery operations, last {windowDays} days · {COUNT.format(productCount)} products in the catalog
          </p>
        </div>
        <div className="admin-actions">
          <Link className="admin-button" href="/admin/orders">
            All orders
          </Link>
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
            hint="Excludes cancelled, refused and returned orders"
            trend={{ change: percentChange(revenue, sumOrderRevenue(prior)), caption: priorCaption }}
          />
          <KpiCard
            label="Orders"
            value={COUNT.format(current.length)}
            href="/admin/orders"
            trend={{ change: percentChange(current.length, prior.length), caption: priorCaption }}
          />
          <KpiCard label="Customers" value={COUNT.format(customerCount)} href="/admin/customers" hint="All time" />
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
            label="Refused or returned"
            value={rate(outcomes.refusalRate)}
            alert={outcomes.failed > 0}
            hint={outcomes.settled === 0 ? "No parcel has settled yet" : `${COUNT.format(outcomes.failed)} parcels`}
          />
          <KpiCard
            label="Awaiting confirmation"
            value={COUNT.format(pendingCalls)}
            href="/admin/orders?status=pending"
            alert={pendingCalls > 0}
            hint="Call before packing"
          />
          <KpiCard
            label="Low stock"
            value={COUNT.format(lowStock.length)}
            href="/admin/products"
            alert={lowStock.length > 0}
            hint="Tracked variants at or below 5"
          />
        </div>
      </section>

      <div className="admin-charts">
        <ChartCard
          title="Revenue and orders"
          description={`Daily, last ${windowDays} days`}
          isEmpty={current.length === 0}
          emptyMessage="No orders in this window, so there is nothing to plot yet."
          summary={`${formatMoney(revenue, currency)} across ${COUNT.format(current.length)} orders.`}
        >
          <RevenueOrdersChart data={buckets} currency={currency} />
        </ChartCard>

        <ChartCard
          title="Order status"
          description="Where the current window's orders stand"
          isEmpty={statusSlices.length === 0}
          summary={statusSlices.map((slice) => `${slice.label}: ${slice.count}`).join(" · ")}
        >
          <StatusDistributionChart data={statusSlices} />
        </ChartCard>

        <ChartCard
          title="Delivered vs refused"
          description="The COD outcome that decides whether an order becomes cash"
          isEmpty={outcomes.settled === 0}
          emptyMessage="No parcel has been delivered, refused or returned in this window."
          summary={`${COUNT.format(outcomes.delivered)} delivered, ${COUNT.format(outcomes.failed)} refused or returned.`}
        >
          <DeliveryTrendChart data={buckets} />
        </ChartCard>

        <ChartCard
          title="Top products"
          description={`Units sold, last ${windowDays * 2} days`}
          isEmpty={topProducts.length === 0}
          summary={topProducts.map((product) => `${product.productTitle}: ${product.quantity}`).join(" · ")}
        >
          <TopProductsChart data={topProducts} currency={currency} />
        </ChartCard>
      </div>

      <div className="admin-columns">
        <section className="admin-panel">
          <h2>Recent orders</h2>
          {recentOrders.length === 0 ? (
            <p className="admin-empty">No orders yet.</p>
          ) : (
            <table className="admin-table admin-data-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Placed</th>
                  <th scope="col">Status</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Order">
                      <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                    </td>
                    <td data-label="Placed">
                      <time dateTime={order.placedAt.toISOString()}>{formatDate(order.placedAt)}</time>
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={order.status} />
                    </td>
                    <td data-label="Total">{formatMoney(order.totalAmount, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-panel">
          <h2>
            <PhoneCall aria-hidden size={14} /> Awaiting confirmation
          </h2>
          {awaitingConfirmation.length === 0 ? (
            <p className="admin-empty">Every order has been called.</p>
          ) : (
            <ul className="admin-list">
              {awaitingConfirmation.map((order) => (
                <li key={order.id}>
                  <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                  <span className="admin-hint">
                    {order.shippingAddress.fullName} · {order.contactPhone}
                  </span>
                  <span>{formatMoney(order.totalAmount, order.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-panel">
          <h2>
            <PackageSearch aria-hidden size={14} /> Shipments missing tracking
          </h2>
          {missingTracking.length === 0 ? (
            <p className="admin-empty">Every shipped parcel has a tracking number.</p>
          ) : (
            <ul className="admin-list">
              {missingTracking.map((order) => (
                <li key={order.id}>
                  <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                  <span className="admin-hint">Shipped {formatDate(order.placedAt)}</span>
                  <span>{formatMoney(order.totalAmount, order.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-panel">
          <h2>
            <AlertTriangle aria-hidden size={14} /> Low stock
          </h2>
          {lowStock.length === 0 ? (
            <p className="admin-empty">Nothing is running low.</p>
          ) : (
            <table className="admin-table admin-data-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Left</th>
                  <th scope="col">Adjust</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((variant) => (
                  <tr key={variant.id}>
                    <td className="admin-cell-wrap" data-label="Product">
                      <Link href={`/admin/products/${variant.productId}`}>{variant.productTitle}</Link>
                    </td>
                    <td data-label="SKU">{variant.sku}</td>
                    <td data-label="Left">{variant.stockQuantity}</td>
                    <td data-label="Adjust">
                      <StockAdjustControl
                        variantId={variant.id}
                        sku={variant.sku}
                        stockQuantity={variant.stockQuantity}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-panel">
          <h2>Best sellers</h2>
          {topProducts.length === 0 ? (
            <p className="admin-empty">Nothing has sold in this window.</p>
          ) : (
            <ul className="admin-list">
              {topProducts.map((product) => (
                <li key={product.productTitle}>
                  {product.productId ? (
                    <Link href={`/admin/products/${product.productId}`}>{product.productTitle}</Link>
                  ) : (
                    <span>{product.productTitle}</span>
                  )}
                  <span className="admin-hint">{COUNT.format(product.quantity)} sold</span>
                  <span>{formatMoney(product.revenue, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
