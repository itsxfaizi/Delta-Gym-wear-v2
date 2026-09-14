import "server-only";

import { and, eq } from "drizzle-orm";

import { isVariantPurchasable } from "./stock";
import { DEVELOPMENT_SEED_PRODUCTS, validateDevelopmentSeedAssets } from "./seed";
import type { CatalogCollection, CatalogFilters, CatalogProduct } from "./types";
import { createDatabase } from "@/server/db";
import { getCatalogTenantId } from "@/server/env";
import { mediaReferences, productVariants, products } from "@/server/db/schema";

function seedOrThrow(): readonly CatalogProduct[] {
  // Approved Phase 4A deviation: keep the exact exported Figma crops usable as
  // temporary development seed content until the Supabase catalog is provisioned.
  validateDevelopmentSeedAssets();
  // NEXT_PHASE is set by Next itself during any build, however it was launched;
  // npm_lifecycle_event only exists under `npm run build` and broke `npx next build`.
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("Development catalog seed content is disabled in the production runtime.");
  }
  return DEVELOPMENT_SEED_PRODUCTS;
}

const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  q: "",
  sizes: [],
  colors: [],
  sort: "featured",
};

const catalogTextCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function compareProductTitles(left: CatalogProduct, right: CatalogProduct): number {
  return catalogTextCollator.compare(left.title, right.title)
    || catalogTextCollator.compare(left.handle, right.handle);
}

function compareFeaturedProducts(left: CatalogProduct, right: CatalogProduct): number {
  // No editorial rank is approved yet, so the existing public handle is the
  // deterministic featured ordering until an authoritative rank exists.
  return catalogTextCollator.compare(left.handle, right.handle);
}

function matchesSelectedVariant(product: CatalogProduct, filters: CatalogFilters): boolean {
  if (filters.sizes.length === 0 && filters.colors.length === 0) return true;

  return product.variants.some((variant) => {
    const size = variant.size?.trim().toLowerCase();
    const color = variant.color?.trim().toLowerCase();
    const matchesSize = filters.sizes.length === 0 || (size !== undefined && filters.sizes.includes(size));
    const matchesColor = filters.colors.length === 0 || (color !== undefined && filters.colors.includes(color));
    return matchesSize && matchesColor;
  });
}

function matchesCatalogQuery(product: CatalogProduct, q: string): boolean {
  if (!q) return true;
  return product.title.toLowerCase().includes(q)
    || product.handle.toLowerCase().includes(q)
    || product.description?.toLowerCase().includes(q) === true;
}

function compareCatalogProducts(left: CatalogProduct, right: CatalogProduct, sort: CatalogFilters["sort"]): number {
  if (sort === "featured") return compareFeaturedProducts(left, right);
  if (sort === "title-asc") return compareProductTitles(left, right);

  const priceDifference = left.priceAmount - right.priceAmount;
  const priceOrder = sort === "price-asc" ? priceDifference : -priceDifference;
  return priceOrder || compareProductTitles(left, right);
}

/** Applies an already-normalized catalog query without mutating the source products. */
export function filterPublishedProducts(
  products: readonly CatalogProduct[],
  filters: CatalogFilters,
): readonly CatalogProduct[] {
  return products
    .filter((product) => matchesCatalogQuery(product, filters.q)
      && matchesSelectedVariant(product, filters)
      && (!filters.inStockOnly || product.variants.some(isVariantPurchasable)))
    .toSorted((left, right) => compareCatalogProducts(left, right, filters.sort));
}

export async function listPublishedProducts(): Promise<readonly CatalogProduct[]> {
  if (!process.env.DATABASE_URL) return seedOrThrow();

  const db = createDatabase();
  const tenantId = getCatalogTenantId();
  const rows = await db.select().from(products).where(and(eq(products.tenantId, tenantId), eq(products.status, "published")));
  return Promise.all(rows.map((product) => getPublishedProduct(product.handle, db, tenantId))).then((items) =>
    items.filter((item): item is CatalogProduct => item !== null),
  );
}

/** Reads the public catalog with normalized URL filters applied to published products only. */
export async function queryPublishedProducts(
  filters: CatalogFilters = DEFAULT_CATALOG_FILTERS,
): Promise<readonly CatalogProduct[]> {
  return filterPublishedProducts(await listPublishedProducts(), filters);
}

/**
 * The launch catalog has no persisted collection records. The all collection
 * is therefore derived from the current published product projection.
 */
export async function getPublishedCollection(
  handle: string,
  filters: CatalogFilters = DEFAULT_CATALOG_FILTERS,
): Promise<CatalogCollection | null> {
  if (handle.trim().toLowerCase() !== "all") return null;

  return {
    handle: "all",
    title: "All Products",
    products: await queryPublishedProducts(filters),
  };
}

export async function getPublishedProduct(
  handle: string,
  database?: ReturnType<typeof createDatabase>,
  scopedTenantId?: string,
): Promise<CatalogProduct | null> {
  const normalizedHandle = handle.trim().toLowerCase();
  if (!normalizedHandle || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedHandle)) return null;

  if (!process.env.DATABASE_URL) {
    return seedOrThrow().find((product) => product.handle === normalizedHandle) ?? null;
  }

  const db = database ?? createDatabase();
  const tenantId = scopedTenantId ?? getCatalogTenantId();
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.handle, normalizedHandle), eq(products.status, "published")))
    .limit(1);
  if (!product) return null;

  const [variants, media] = await Promise.all([
    db.select().from(productVariants).where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.productId, product.id))),
    db.select().from(mediaReferences).where(and(eq(mediaReferences.tenantId, tenantId), eq(mediaReferences.productId, product.id), eq(mediaReferences.status, "active"))),
  ]);

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: product.description,
    status: "published",
    // Database stores minor units. Currency formatting belongs to the UI boundary.
    priceAmount: variants[0]?.priceAmount ?? 0,
    compareAtPriceAmount: variants[0]?.compareAtPriceAmount ?? null,
    currency: variants[0]?.currency ?? "PKR",
    rating: null,
    reviewCount: 0,
    source: "database",
    images: media.map((item) => ({ src: item.objectKey, alt: item.altText ?? product.title })),
    variants: variants.map((item) => ({
      id: item.id,
      sku: item.sku,
      color: item.color,
      size: item.size,
      priceAmount: item.priceAmount,
      compareAtPriceAmount: item.compareAtPriceAmount,
      currency: item.currency,
      isAvailable: item.isAvailable,
      stockQuantity: item.stockQuantity,
      stockPolicy: item.stockPolicy,
    })),
  };
}
