import Link from "next/link";
import { formatDate } from "@/lib/datetime";

import { ListFilters } from "@/components/admin/list-filters";
import { ProductStatusActions } from "@/components/admin/product-status-actions";
import { ADMIN_PAGE_SIZE, PRODUCT_STATUSES, parseProductFilters } from "@/features/admin/schemas";
import { formatMoney } from "@/lib/money";
import { listAdminProducts } from "@/server/admin/queries";


function pageHref(filters: { q: string; status: string | null }, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/products?${query}` : "/admin/products";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseProductFilters(await searchParams);
  const { rows, total, pageCount } = await listAdminProducts(filters);

  return (
    <>
      <div className="admin-header">
        <h1>Products</h1>
        <Link className="admin-button admin-button--primary" href="/admin/products/new">
          New product
        </Link>
      </div>

      <ListFilters
        action="/admin/products"
        q={filters.q}
        status={filters.status}
        statuses={PRODUCT_STATUSES}
        searchLabel="Search title or handle"
      />

      {rows.length === 0 ? (
        <p className="admin-empty">No products match this view.</p>
      ) : (
        <div className="admin-panel admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Handle</th>
                <th scope="col">Status</th>
                <th scope="col">Variants</th>
                <th scope="col">From</th>
                <th scope="col">Stock</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => (
                <tr key={product.id}>
                  <td className="admin-cell-wrap">
                    <Link href={`/admin/products/${product.id}`}>{product.title}</Link>
                  </td>
                  <td>{product.handle}</td>
                  <td>
                    <span className="admin-status" data-status={product.status}>
                      {product.status}
                    </span>
                  </td>
                  <td>{product.variantCount}</td>
                  <td>{product.lowestPriceAmount === null ? "—" : formatMoney(product.lowestPriceAmount)}</td>
                  <td>{product.totalStock}</td>
                  <td>
                    <time dateTime={product.updatedAt.toISOString()}>{formatDate(product.updatedAt)}</time>
                  </td>
                  <td>
                    <ProductStatusActions productId={product.id} status={product.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="admin-actions" aria-label="Pagination">
        {filters.page > 1 ? (
          <Link className="admin-button" href={pageHref(filters, filters.page - 1)}>
            Previous
          </Link>
        ) : null}
        <p className="admin-hint">
          Page {filters.page} of {pageCount} · {total} products · {ADMIN_PAGE_SIZE} per page
        </p>
        {filters.page < pageCount ? (
          <Link className="admin-button" href={pageHref(filters, filters.page + 1)}>
            Next
          </Link>
        ) : null}
      </nav>
    </>
  );
}
