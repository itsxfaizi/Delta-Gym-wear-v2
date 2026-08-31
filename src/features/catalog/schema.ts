import { z } from "zod";

import { CATALOG_SORTS, PRODUCT_STATUSES, TENANT_ROLES, type CatalogFilters } from "./types";

export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export const tenantRoleSchema = z.enum(TENANT_ROLES);

export const productStatusTransitionSchema = z.object({
  productId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  from: productStatusSchema,
  to: productStatusSchema,
});

export type ProductStatusTransitionInput = z.infer<typeof productStatusTransitionSchema>;

type CatalogSearchParamValue = string | readonly string[] | undefined;

export type CatalogSearchParams = Readonly<Record<string, CatalogSearchParamValue>> | URLSearchParams;

const MAX_CATALOG_QUERY_LENGTH = 120;
const MAX_CATALOG_FILTER_VALUES = 16;
const MAX_CATALOG_FILTER_VALUE_LENGTH = 64;

const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  q: "",
  sizes: [],
  colors: [],
  sort: "featured",
};

function getCatalogSearchParamValues(
  raw: CatalogSearchParams,
  key: string,
): readonly string[] {
  if (raw instanceof URLSearchParams) return raw.getAll(key);

  const value = raw[key];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function normalizeCatalogFilterValues(values: readonly string[]): readonly string[] {
  return [...new Set(
    values
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0 && value.length <= MAX_CATALOG_FILTER_VALUE_LENGTH),
  )]
    .sort()
    .slice(0, MAX_CATALOG_FILTER_VALUES);
}

/**
 * Converts untrusted storefront URL parameters into a bounded, canonical
 * catalog query. Unsupported sort values safely fall back to featured.
 */
export function parseCatalogSearchParams(raw: CatalogSearchParams): CatalogFilters {
  const q = getCatalogSearchParamValues(raw, "q")[0]?.trim().toLowerCase() ?? "";
  const sortValue = getCatalogSearchParamValues(raw, "sort")[0]?.trim().toLowerCase();
  const sort = CATALOG_SORTS.includes(sortValue as (typeof CATALOG_SORTS)[number])
    ? (sortValue as CatalogFilters["sort"])
    : DEFAULT_CATALOG_FILTERS.sort;

  return {
    q: q.slice(0, MAX_CATALOG_QUERY_LENGTH),
    sizes: normalizeCatalogFilterValues(getCatalogSearchParamValues(raw, "size")),
    colors: normalizeCatalogFilterValues(getCatalogSearchParamValues(raw, "color")),
    sort,
  };
}
