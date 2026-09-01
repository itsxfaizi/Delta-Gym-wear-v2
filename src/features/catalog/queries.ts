import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { cache } from "react";

import { DEVELOPMENT_SEED_PRODUCTS, validateDevelopmentSeedAssets } from "./seed";
import type { CatalogCollection, CatalogFilters, CatalogProduct } from "./types";
import { createDatabase } from "@/server/db";
import { getCatalogTenantId } from "@/server/env";
import { log } from "@/server/observability/logger";
import { getRequestId } from "@/server/observability/request-id";
import {
  mediaReferences,
  productVariants,
  products,
  type MediaReference,
  type Product,
  type ProductVariant,
} from "@/server/db/schema";

function seedOrThrow(): readonly CatalogProduct[] {
  // Approved Phase 4A deviation: keep the exact exported Figma crops usable as
  // temporary development seed content until the Supabase catalog is provisioned.
  validateDevelopmentSeedAssets();
  if (process.env.NODE_ENV === "production" && process.env.npm_lifecycle_event !== "build") {
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
    .filter((product) => matchesCatalogQuery(product, filters.q) && matchesSelectedVariant(product, filters))
    .toSorted((left, right) => compareCatalogProducts(left, right, filters.sort));
}

function groupByProductId<T extends { productId: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.productId);
    if (bucket) bucket.push(row);
    else grouped.set(row.productId, [row]);
  }
  return grouped;
}

function toCatalogProduct(
  product: Product,
  variants: readonly ProductVariant[],
  media: readonly MediaReference[],
): CatalogProduct {
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
    // `objectKey` is an opaque storage key, not a public URL. No storage bucket
    // or CDN origin is approved yet, so this stays a pass-through until one is.
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
    })),
  };
}

/**
 * Deterministic child ordering. Creation order is the intent; the unique
 * `sku` / `object_key` tie breaker keeps price, hero image, sort order and
 * JSON-LD offers stable when timestamps collide.
 */
function selectVariantsFor(db: ReturnType<typeof createDatabase>, tenantId: string, productIds: readonly string[]) {
  return db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.tenantId, tenantId), inArray(productVariants.productId, productIds)))
    .orderBy(asc(productVariants.createdAt), asc(productVariants.sku));
}

function selectMediaFor(db: ReturnType<typeof createDatabase>, tenantId: string, productIds: readonly string[]) {
  return db
    .select()
    .from(mediaReferences)
    .where(
      and(
        eq(mediaReferences.tenantId, tenantId),
        inArray(mediaReferences.productId, productIds),
        eq(mediaReferences.status, "active"),
      ),
    )
    .orderBy(asc(mediaReferences.createdAt), asc(mediaReferences.objectKey));
}

/**
 * Request-memoised so the store layout, the page and the PDP metadata pass
 * share one read. Three queries total, never one per product.
 */
export const listPublishedProducts = cache(async (): Promise<readonly CatalogProduct[]> => {
  if (!process.env.DATABASE_URL) return seedOrThrow();

  const db = createDatabase();
  const tenantId = getCatalogTenantId();
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.status, "published")))
    .orderBy(asc(products.handle));

  log("info", "catalog.list_published_products", { requestId: await getRequestId(), products: rows.length });
  if (rows.length === 0) return [];

  const productIds = rows.map((product) => product.id);
  const [variants, media] = await Promise.all([
    selectVariantsFor(db, tenantId, productIds),
    selectMediaFor(db, tenantId, productIds),
  ]);
  const variantsByProduct = groupByProductId(variants);
  const mediaByProduct = groupByProductId(media);

  return rows.map((product) =>
    toCatalogProduct(product, variantsByProduct.get(product.id) ?? [], mediaByProduct.get(product.id) ?? []),
  );
});

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

/** Request-memoised so `generateMetadata` and the PDP body read once. */
export const getPublishedProduct = cache(async (handle: string): Promise<CatalogProduct | null> => {
  const normalizedHandle = handle.trim().toLowerCase();
  if (!normalizedHandle || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedHandle)) return null;

  if (!process.env.DATABASE_URL) {
    return seedOrThrow().find((product) => product.handle === normalizedHandle) ?? null;
  }

  const db = createDatabase();
  const tenantId = getCatalogTenantId();
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.handle, normalizedHandle), eq(products.status, "published")))
    .limit(1);

  log("info", "catalog.get_published_product", { requestId: await getRequestId(), found: Boolean(product) });
  if (!product) return null;

  const [variants, media] = await Promise.all([
    selectVariantsFor(db, tenantId, [product.id]),
    selectMediaFor(db, tenantId, [product.id]),
  ]);

  return toCatalogProduct(product, variants, media);
});
