import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";

import { OrderSelection, type SelectableOrderRow } from "@/components/admin/order-selection";
import { ADMIN_PAGE_SIZE } from "@/features/admin/schemas";
import { ORDER_STATUS_META } from "@/features/orders/status";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentStatus,
} from "@/features/orders/types";
import { formatMoney } from "@/lib/money";
import { resolveCodStatus } from "@/server/ops/order-ops";
import {
  OrdersDatabaseUnavailableError,
  countOrdersPerStatus,
  listOrders,
} from "@/server/orders/queries";

import "../../../../styles/admin-ops.css";

/** Windows offered by the "Placed" filter; the value is a day count. */
const PLACED_WINDOWS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

/** The stored payment status is a lowercase enum; the console shows it as prose. */
function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Cash-on-delivery wording for the payment column and its filter. */
const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Pending on delivery",
  paid: "Collected",
  refunded: "Refunded",
};

/** A parcel that never got delivered was never collected, whatever the enum says. */
const NOT_COLLECTED = new Set(["refused", "returned_to_sender", "cancelled"]);

function paymentLabelFor(payment: PaymentStatus, codStatus: string): string {
  if (payment === "unpaid" && NOT_COLLECTED.has(codStatus)) return "Not collected";
  return PAYMENT_LABELS[payment] ?? titleCase(payment);
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Reads degrade to an empty list without a database, matching src/server/admin/queries.ts. */
async function withoutDatabase<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof OrdersDatabaseUnavailableError) return fallback;
    throw error;
  }
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawStatus = first(params.status);
  const status = (ORDER_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as OrderStatus)
    : undefined;
  const rawPayment = first(params.payment);
  const paymentStatus = (PAYMENT_STATUSES as readonly string[]).includes(rawPayment)
    ? (rawPayment as PaymentStatus)
    : undefined;
  const rawPlaced = first(params.placed);
  const placed = PLACED_WINDOWS.some((window) => window.value === rawPlaced) ? rawPlaced : "";
  const placedWithinDays = placed ? Number(placed) : undefined;
  const search = first(params.q).trim().slice(0, 80);
  const parsedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : 1;

  const filters = { search, paymentStatus, placedWithinDays };
  const [{ orders, total }, statusCounts] = await Promise.all([
    withoutDatabase(
      () =>
        listOrders({
          ...filters,
          status,
          limit: ADMIN_PAGE_SIZE,
          offset: (page - 1) * ADMIN_PAGE_SIZE,
        }),
      { orders: [], total: 0 },
    ),
    withoutDatabase(
      () => countOrdersPerStatus(filters),
      Object.fromEntries(ORDER_STATUSES.map((value) => [value, 0])) as Record<OrderStatus, number>,
    ),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const windowTotal = ORDER_STATUSES.reduce((sum, value) => sum + statusCounts[value], 0);

  // Every row goes through the overlay: confirmation_required also persists as a
  // different column value, so a shipped-only shortcut showed the wrong badge.
  // ponytail: the ?status= filter still queries the DB column, so a row shown as
  // Refused is still matched by status=shipped. Needs a cod_status column to fix.
  const rows: SelectableOrderRow[] = await Promise.all(
    orders.map(async (order) => {
      const codStatus = await resolveCodStatus(order.id, order.status);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: codStatus,
        placedAtIso: order.placedAt.toISOString(),
        placedAtLabel: formatDateTime(order.placedAt),
        customerName: order.shippingAddress.fullName,
        contactPhone: order.contactPhone,
        paymentLabel: paymentLabelFor(order.paymentStatus, codStatus),
        totalLabel: formatMoney(order.totalAmount, order.currency),
      };
    }),
  );

  const hrefFor = (next: { status?: OrderStatus | null; page?: number }) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (placed) query.set("placed", placed);
    if (paymentStatus) query.set("payment", paymentStatus);
    const nextStatus = next.status === undefined ? status : next.status;
    if (nextStatus) query.set("status", nextStatus);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    return query.size ? `/admin/orders?${query}` : "/admin/orders";
  };

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Orders</h1>
          <p className="admin-hint">
            {rows.length} of {total} orders in this window
          </p>
        </div>
      </div>

      <form className="admin-toolbar orders-toolbar" action="/admin/orders" method="get">
        <div className="admin-field admin-field--wide">
          <label htmlFor="filter-q">Search order number, email or phone</label>
          <input id="filter-q" type="search" name="q" defaultValue={search} />
        </div>
        <div className="admin-field">
          <label htmlFor="filter-placed">Placed</label>
          <select id="filter-placed" name="placed" defaultValue={placed}>
            <option value="">Any time</option>
            {PLACED_WINDOWS.map((window) => (
              <option key={window.value} value={window.value}>
                {window.label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="filter-payment">Payment</label>
          <select id="filter-payment" name="payment" defaultValue={paymentStatus ?? ""}>
            <option value="">Any</option>
            {PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button className="admin-button" type="submit">
          Search
        </button>
      </form>

      <nav className="admin-tabs orders-tabs" aria-label="Filter by status">
        <Link
          className="admin-tab"
          href={hrefFor({ status: null })}
          aria-current={status ? undefined : "page"}
        >
          All <span className="admin-tab-count">{windowTotal}</span>
        </Link>
        {ORDER_STATUSES.map((value) => (
          <Link
            key={value}
            className="admin-tab"
            href={hrefFor({ status: value })}
            aria-current={status === value ? "page" : undefined}
          >
            {ORDER_STATUS_META[value].label}{" "}
            <span className="admin-tab-count">{statusCounts[value]}</span>
          </Link>
        ))}
      </nav>

      <OrderSelection rows={rows}>
        <nav className="admin-pagination orders-pagination" aria-label="Pagination">
          <p>
            Page {page} of {pageCount} · {ADMIN_PAGE_SIZE} per page
          </p>
          <div className="admin-actions">
            {page > 1 ? (
              <Link className="admin-button" href={hrefFor({ page: page - 1 })}>
                Previous
              </Link>
            ) : (
              <span className="admin-button" aria-disabled="true">
                Previous
              </span>
            )}
            {page < pageCount ? (
              <Link className="admin-button admin-button--next" href={hrefFor({ page: page + 1 })}>
                Next
              </Link>
            ) : (
              <span className="admin-button admin-button--next" aria-disabled="true">
                Next
              </span>
            )}
          </div>
        </nav>
      </OrderSelection>
    </>
  );
}
