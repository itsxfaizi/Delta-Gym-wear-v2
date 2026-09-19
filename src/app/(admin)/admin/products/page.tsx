import Link from "next/link";
import { formatDate } from "@/lib/datetime";

import { ProductStatusActions } from "@/components/admin/product-status-actions";
import { LOW_STOCK_THRESHOLD } from "@/features/admin/dashboard";
import {
  ADMIN_PAGE_SIZE,
  PRODUCT_PUBLISHER_ROLES,
  PRODUCT_STATUSES,
  parseProductFilters,
} from "@/features/admin/schemas";
import { formatMoney } from "@/lib/money";
import { resolveAdminAccess } from "@/server/admin/guard";
import { listAdminProducts } from "@/server/admin/queries";

import "../../../../styles/admin-products.css";

/** A fixed reference shelf: per-variant capacity is not in the schema, so the
 *  bar reads total stock against a constant and saturates above it. The number
 *  beside the bar stays the source of truth. */
const STOCK_BAR_CEILING = 120;

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
  const [{ rows, total, pageCount }, access] = await Promise.all([listAdminProducts(filters), resolveAdminAccess()]);

  // The layout gates ADMIN_ROLES; publishing is narrower, so a catalog_editor
  // never sees a button the action would refuse.
  const canPublish =
    access.state === "granted" &&
    (PRODUCT_PUBLISHER_ROLES as readonly string[]).includes(access.principal.membership.role);

  // Page-scoped on purpose: the list query only loads this page's variants.
  const variantsOnPage = rows.reduce((sum, row) => sum + row.variantCount, 0);
  const lowOnPage = rows.filter((row) => row.totalStock <= LOW_STOCK_THRESHOLD).length;

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Products</h1>
          <p className="admin-hint">
            {total} products
            {rows.length > 0
              ? ` · ${variantsOnPage} variants · ${lowOnPage} products at or below ${LOW_STOCK_THRESHOLD}`
              : null}
          </p>
        </div>
        <div className="admin-actions">
          <Link className="admin-button admin-button--primary" href="/admin/products/new">
            New product
          </Link>
        </div>
      </div>

      <form className="admin-toolbar products-toolbar" action="/admin/products" method="get">
        <div className="admin-field admin-field--wide">
          <label htmlFor="filter-q">Search title or handle</label>
          <input id="filter-q" type="search" name="q" defaultValue={filters.q} />
        </div>
        <div className="admin-field admin-field-status">
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Any</option>
            {PRODUCT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <button className="admin-button" type="submit">
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="admin-empty">No products match this view.</p>
      ) : (
        <div className="admin-panel">
          <div className="admin-table-scroll">
            <table className="admin-table admin-data-table products-table">
              <thead>
                <tr>
                  <th scope="col">Title / handle</th>
                  <th scope="col">Status</th>
                  <th className="admin-num" scope="col">
                    Variants
                  </th>
                  <th className="admin-num" scope="col">
                    From
                  </th>
                  <th scope="col">Stock</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const isLow = product.totalStock <= LOW_STOCK_THRESHOLD;
                  return (
                    <tr key={product.id}>
                      <td className="admin-cell-wrap products-title" data-label="Title / handle">
                        <Link href={`/admin/products/${product.id}`}>{product.title}</Link>
                        <span className="admin-meta">{product.handle}</span>
                      </td>
                      <td data-label="Status">
                        <span className="admin-status" data-status={product.status}>
                          {product.status}
                        </span>
                      </td>
                      <td className="admin-num" data-label="Variants">
                        {product.variantCount}
                      </td>
                      <td className="admin-num" data-label="From">
                        {product.lowestPriceAmount === null ? "—" : formatMoney(product.lowestPriceAmount)}
                      </td>
                      <td data-label="Stock">
                        <span className="products-stock" data-low={isLow ? "true" : "false"}>
                          <span className="products-stock-track" aria-hidden="true">
                            <span
                              className="products-stock-fill"
                              style={{
                                inlineSize: `${Math.min(100, Math.round((product.totalStock / STOCK_BAR_CEILING) * 100))}%`,
                              }}
                            />
                          </span>
                          <span className="products-stock-value">{product.totalStock}</span>
                        </span>
                      </td>
                      <td className="products-updated" data-label="Updated">
                        <time dateTime={product.updatedAt.toISOString()}>{formatDate(product.updatedAt)}</time>
                      </td>
                      <td data-label="Actions">
                        <span className="products-row-actions">
                          <Link className="admin-button" href={`/admin/products/${product.id}`}>
                            Edit
                          </Link>
                          {canPublish ? <ProductStatusActions productId={product.id} status={product.status} /> : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav className="admin-pagination products-pagination" aria-label="Pagination">
            <p className="admin-hint">
              Page {filters.page} of {pageCount} · {total} products · {ADMIN_PAGE_SIZE} per page
            </p>
            <div className="admin-actions">
              {filters.page > 1 ? (
                <Link className="admin-button" href={pageHref(filters, filters.page - 1)}>
                  Previous
                </Link>
              ) : (
                <span className="admin-button" aria-disabled="true">
                  Previous
                </span>
              )}
              {filters.page < pageCount ? (
                <Link className="admin-button admin-button--next" href={pageHref(filters, filters.page + 1)}>
                  Next
                </Link>
              ) : (
                <span className="admin-button admin-button--next" aria-disabled="true">
                  Next
                </span>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
