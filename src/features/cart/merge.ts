import type { CartLineInput } from "@/features/catalog/cart";
import { maxPurchasableQuantity } from "@/features/catalog/stock";
import type { CatalogVariant } from "@/features/catalog/types";

export type MergeableVariant = Pick<CatalogVariant, "isAvailable" | "stockQuantity" | "stockPolicy">;

/**
 * Combines a signed-in shopper's local (localStorage) cart with whatever is
 * already attached to their server cart. Same variant on both sides: quantities
 * add, capped at 99. The combined quantity is then clamped to what is actually
 * purchasable right now; a variant that no longer resolves or is out of stock
 * is dropped entirely. Pure and DB-free so it is fully unit-testable.
 */
export function mergeCartLines(
  localLines: readonly CartLineInput[],
  serverLines: readonly CartLineInput[],
  resolveVariant: (variantId: string) => MergeableVariant | undefined,
): CartLineInput[] {
  const combined = new Map<string, CartLineInput>();

  for (const line of [...serverLines, ...localLines]) {
    const existing = combined.get(line.variantId);
    combined.set(line.variantId, existing
      ? { ...existing, quantity: Math.min(99, existing.quantity + line.quantity) }
      : line);
  }

  return [...combined.values()].flatMap((line) => {
    const variant = resolveVariant(line.variantId);
    if (!variant) return [];
    const quantity = maxPurchasableQuantity(variant as CatalogVariant, line.quantity);
    return quantity > 0 ? [{ ...line, quantity }] : [];
  });
}
