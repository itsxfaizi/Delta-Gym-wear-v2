import type { CatalogFacets, CatalogFilters, CatalogProduct } from "@/features/catalog/types";

import { CatalogControls } from "./catalog-controls";
import { CatalogSortControl } from "./catalog-sort-control";
import { Reveal } from "./motion";
import { ProductCard } from "./product-card";

export function CatalogView({
  products,
  filters,
  facets,
  title = "All Products",
}: {
  products: readonly CatalogProduct[];
  filters: CatalogFilters;
  facets: CatalogFacets;
  title?: string;
}) {
  const hasFilters = Boolean(filters.q || filters.sizes.length || filters.colors.length || filters.maxPrice);
  const resultSummary = `${products.length} product${products.length === 1 ? "" : "s"}`;
  // Filters and search live entirely in the URL, so the local control state is
  // re-seeded from the server-parsed filters whenever that URL changes.
  const controlsKey = `${filters.q}:${filters.sizes.join(",")}:${filters.colors.join(",")}:${filters.maxPrice ?? ""}:${filters.sort}`;

  return (
    <main className="catalog-page">
      <div className="catalog-layout">
        <aside className="catalog-sidebar" aria-label="Catalog search and filters">
          <h2>Filters</h2>
          <CatalogControls
            key={controlsKey}
            filters={filters}
            facets={facets}
            currency={products[0]?.currency ?? "PKR"}
          />
        </aside>
        <div className="catalog-results">
          <div className="catalog-title-row">
            <div>
              <h1>{title}</h1>
              {/* Only the count is announced: a live region over the grid itself
                  would re-read every card on each filter change. */}
              <p role="status">{resultSummary}</p>
            </div>
            <CatalogSortControl value={filters.sort} />
          </div>
          <section className="product-grid" aria-label="Products">
            {products.length ? products.map((product, index) => (
              <Reveal key={product.handle} variant="cards" index={index}>
                <ProductCard product={product} index={index} />
              </Reveal>
            )) : (
              <div className="empty-state catalog-empty">
                <h2>{hasFilters ? "No products match" : "No published products"}</h2>
                <p>{hasFilters ? "Clear the current search and filters to see the full catalog." : "The catalog is currently empty."}</p>
                {hasFilters ? <a className="primary-link" href="/shop">Clear filters</a> : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
