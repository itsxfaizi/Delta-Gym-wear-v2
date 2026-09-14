import type { CatalogVariant, StockPolicy } from "./types";

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** Variants without a stockQuantity are untracked: availability alone decides. */
function trackedStock(variant: CatalogVariant): number | null {
  return typeof variant.stockQuantity === "number" ? Math.max(0, Math.trunc(variant.stockQuantity)) : null;
}

function policyOf(variant: CatalogVariant): StockPolicy {
  return variant.stockPolicy ?? "deny";
}

export function isVariantPurchasable(variant: CatalogVariant): boolean {
  if (!variant.isAvailable) return false;
  const stock = trackedStock(variant);
  return stock === null || policyOf(variant) === "continue" || stock > 0;
}

/** Clamps a requested quantity to what the variant can actually sell. */
export function maxPurchasableQuantity(variant: CatalogVariant, requestedQuantity: number): number {
  const requested = Number.isFinite(requestedQuantity) ? Math.max(0, Math.trunc(requestedQuantity)) : 0;
  if (requested === 0 || !isVariantPurchasable(variant)) return 0;

  const stock = trackedStock(variant);
  // 'continue' allows backorder, so tracked stock does not cap the request.
  if (stock === null || policyOf(variant) === "continue") return requested;
  return Math.min(requested, stock);
}

/** Storefront urgency copy, or null when there is nothing worth saying. */
export function lowStockLabel(
  variant: CatalogVariant,
  threshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
): string | null {
  if (!isVariantPurchasable(variant)) return null;
  const stock = trackedStock(variant);
  if (stock === null || policyOf(variant) === "continue") return null;
  if (stock > Math.max(0, Math.trunc(threshold))) return null;
  return `Only ${stock} left`;
}
