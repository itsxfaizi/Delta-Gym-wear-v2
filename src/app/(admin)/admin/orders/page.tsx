import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";

import { ListFilters } from "@/components/admin/list-filters";
import { OrderSelection, type SelectableOrderRow } from "@/components/admin/order-selection";
import { ADMIN_PAGE_SIZE } from "@/features/admin/schemas";
import { ORDER_STATUSES, type OrderStatus } from "@/features/orders/types";
import { formatMoney } from "@/lib/money";
import { resolveCodStatus } from "@/server/ops/order-ops";
import { OrdersDatabaseUnavailableError, listOrders } from "@/server/orders/queries";

import "../../../../styles/admin-customers.css";
import "../../../../styles/admin-ops.css";


function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Reads degrade to an empty list without a database, matching src/server/admin/queries.ts. */
async function listAdminOrders(filters: Parameters<typeof listOrders>[0]) {
  try {
    return await listOrders(filters);
  } catch (error) {
    if (error instanceof OrdersDatabaseUnavailableError) return { orders: [], total: 0 };
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
  const search = first(params.q).trim().slice(0, 80);
  const parsedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : 1;

  const { orders, total } = await listAdminOrders({
    status,
    search,
    limit: ADMIN_PAGE_SIZE,
    offset: (page - 1) * ADMIN_PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  // Every row goes through the overlay: confirmation_required also persists as a
  // different column value, so a shipped-only shortcut showed the wrong badge.
  // ponytail: the ?status= filter still queries the DB column, so a row shown as
  // Refused is still matched by status=shipped. Needs a cod_status column to fix.
  const rows: SelectableOrderRow[] = await Promise.all(
    orders.map(async (order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: await resolveCodStatus(order.id, order.status),
      placedAtIso: order.placedAt.toISOString(),
      placedAtLabel: formatDateTime(order.placedAt),
      customerName: order.shippingAddress.fullName,
      contactPhone: order.contactPhone,
      paymentStatus: order.paymentStatus,
      totalLabel: formatMoney(order.totalAmount, order.currency),
    })),
  );

  const hrefFor = (nextPage: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (status) query.set("status", status);
    if (nextPage > 1) query.set("page", String(nextPage));
    return query.size ? `/admin/orders?${query}` : "/admin/orders";
  };

  return (
    <>
      <div className="admin-header">
        <h1>Orders</h1>
        <p className="admin-hint">{total} orders</p>
      </div>

      <ListFilters
        action="/admin/orders"
        q={search}
        status={status ?? null}
        statuses={ORDER_STATUSES}
        searchLabel="Search order number, email or phone"
      />

      {rows.length === 0 ? (
        <p className="admin-empty">No orders match this view.</p>
      ) : (
        <OrderSelection rows={rows} />
      )}

      <nav className="admin-actions" aria-label="Pagination">
        {page > 1 ? (
          <Link className="admin-button" href={hrefFor(page - 1)}>
            Previous
          </Link>
        ) : null}
        <p className="admin-hint">
          Page {page} of {pageCount}
        </p>
        {page < pageCount ? (
          <Link className="admin-button" href={hrefFor(page + 1)}>
            Next
          </Link>
        ) : null}
      </nav>
    </>
  );
}
