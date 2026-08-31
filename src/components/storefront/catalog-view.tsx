import type { CatalogFilters, CatalogProduct } from "@/features/catalog/types";

import { CatalogControls } from "./catalog-controls";
import { CatalogSortControl } from "./catalog-sort-control";
import { Reveal } from "./motion";
import { ProductCard } from "./product-card";

export function CatalogView({
  products,
  filters,
  title = "All Products",
}: {
  products: readonly CatalogProduct[];
  filters: CatalogFilters;
  title?: string;
}) {
  const hasFilters = Boolean(filters.q || filters.sizes.length || filters.colors.length);
  return (
    <main className="catalog-page">
      <div className="catalog-layout">
        <aside className="catalog-sidebar" aria-label="Catalog search and filters">
          <h2>Filters</h2>
          <CatalogControls key={`${filters.q}:${filters.sizes.join(",")}:${filters.colors.join(",")}:${filters.sort}`} filters={filters} />
        </aside>
        <div className="catalog-results">
          <div className="catalog-title-row">
            <div><h1>{title}</h1><p>{products.length} product{products.length === 1 ? "" : "s"}</p></div>
            <CatalogSortControl value={filters.sort} />
          </div>
          <section className="product-grid" aria-label="Products" aria-live="polite">
            {products.length ? products.map((product, index) => <Reveal key={product.handle} variant="cards" index={index}><ProductCard product={product} /></Reveal>) : (
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
