export const PRODUCT_STATUSES = [
  "draft",
  "published",
  "unpublished",
  "archived",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const TENANT_ROLES = [
  "owner",
  "catalog_editor",
  "publisher",
  "auditor",
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export type CatalogImage = { src: string; alt: string };

export const STOCK_POLICIES = ["deny", "continue"] as const;

/** 'deny' stops at zero stock, 'continue' allows backorder. */
export type StockPolicy = (typeof STOCK_POLICIES)[number];

export type CatalogVariant = {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  priceAmount: number;
  compareAtPriceAmount: number | null;
  currency: string;
  isAvailable: boolean;
  /** Absent means stock is not tracked for this variant. */
  stockQuantity?: number;
  stockPolicy?: StockPolicy;
};

export type CatalogProduct = {
  id: string;
  handle: string;
  title: string;
  description: string | null;
  status: "published";
  priceAmount: number;
  compareAtPriceAmount: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number;
  source: "database" | "development-seed";
  images: CatalogImage[];
  /** Exact Figma Catalog component crops for development-only visual matching. */
  catalogImage?: CatalogImage;
  catalogHoverImage?: CatalogImage;
  variants: CatalogVariant[];
};

export const CATALOG_SORTS = ["featured", "title-asc", "price-asc", "price-desc"] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number];

export type CatalogFilters = {
  q: string;
  sizes: readonly string[];
  colors: readonly string[];
  sort: CatalogSort;
  /** Drops products whose variants are all sold out. */
  inStockOnly?: boolean;
};

export type CatalogCollection = {
  handle: "all";
  title: "All Products";
  products: readonly CatalogProduct[];
};

export type ProductStatusTransition = {
  from: ProductStatus;
  to: ProductStatus;
  requiredRole: TenantRole;
};

const TRANSITIONS: readonly ProductStatusTransition[] = [
  { from: "draft", to: "published", requiredRole: "publisher" },
  { from: "published", to: "unpublished", requiredRole: "publisher" },
  { from: "unpublished", to: "draft", requiredRole: "catalog_editor" },
  { from: "unpublished", to: "archived", requiredRole: "owner" },
  { from: "archived", to: "draft", requiredRole: "owner" },
];

export function getProductStatusTransition(
  from: ProductStatus,
  to: ProductStatus,
): ProductStatusTransition | null {
  return TRANSITIONS.find((transition) => transition.from === from && transition.to === to) ?? null;
}

export function canTransitionProductStatus(
  from: ProductStatus,
  to: ProductStatus,
  role: TenantRole,
): boolean {
  const transition = getProductStatusTransition(from, to);

  // The owner is the tenant's unrestricted content administrator. Other roles
  // must match the minimum role explicitly assigned to the transition.
  return transition !== null && (role === "owner" || role === transition.requiredRole);
}
