import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { CartLineInput } from "@/features/catalog/cart";
import { isVariantPurchasable, maxPurchasableQuantity } from "@/features/catalog/stock";
import type { CatalogVariant, StockPolicy } from "@/features/catalog/types";
import { mergeCartLines } from "@/features/cart/merge";
import type { Database } from "@/server/db";
import { cartItems, carts, productVariants, products, type Cart } from "@/server/db/schema";
import { findCartRow, getCartLines, requireCartDatabase } from "./queries";

type VariantRow = {
  id: string;
  isAvailable: boolean;
  stockQuantity: number;
  stockPolicy: StockPolicy;
  priceAmount: number;
  productHandle: string;
};

async function loadVariants(db: Database, tenantId: string, variantIds: readonly string[]): Promise<Map<string, VariantRow>> {
  if (variantIds.length === 0) return new Map();

  const rows = await db
    .select({
      id: productVariants.id,
      isAvailable: productVariants.isAvailable,
      stockQuantity: productVariants.stockQuantity,
      stockPolicy: productVariants.stockPolicy,
      priceAmount: productVariants.priceAmount,
      productHandle: products.handle,
    })
    .from(productVariants)
    .innerJoin(
      products,
      and(eq(products.id, productVariants.productId), eq(products.tenantId, productVariants.tenantId)),
    )
    .where(and(eq(productVariants.tenantId, tenantId), inArray(productVariants.id, [...variantIds])));

  return new Map(rows.map((row) => [row.id, row]));
}

/** Untrusted lines resolved against the live catalog: unknown/unavailable variants drop, quantity clamps to stock. */
function resolveLines(lines: readonly CartLineInput[], variants: Map<string, VariantRow>): CartLineInput[] {
  return lines.flatMap((line) => {
    const variant = variants.get(line.variantId);
    if (!variant || !isVariantPurchasable(variant as unknown as CatalogVariant)) return [];
    const quantity = maxPurchasableQuantity(variant as unknown as CatalogVariant, line.quantity);
    return quantity > 0 ? [{ productHandle: variant.productHandle, variantId: variant.id, quantity }] : [];
  });
}

async function getOrCreateCartRow(db: Database, tenantId: string, token: string, customerId?: string | null): Promise<Cart> {
  const existing = await findCartRow(db, tenantId, token);
  if (existing) return existing;
  const [created] = await db.insert(carts).values({ tenantId, token, customerId: customerId ?? null }).returning();
  return created;
}

async function replaceCartItems(
  db: Database,
  tenantId: string,
  cartId: string,
  lines: readonly CartLineInput[],
  variants: Map<string, VariantRow>,
): Promise<void> {
  await db.delete(cartItems).where(and(eq(cartItems.tenantId, tenantId), eq(cartItems.cartId, cartId)));
  if (lines.length === 0) return;

  await db.insert(cartItems).values(
    lines.map((line) => {
      const variant = variants.get(line.variantId)!;
      return {
        tenantId,
        cartId,
        productVariantId: line.variantId,
        quantity: line.quantity,
        unitPriceAmount: variant.priceAmount,
      };
    }),
  );
}

// ponytail: cart writes are delete-then-insert without a db.transaction wrapper.
// A cart is disposable, low-stakes state (unlike an order), so a rare
// interleaved double-click losing a line is an acceptable ceiling here.
// Wrap the delete+insert in db.transaction if concurrent multi-tab edits start
// actually mattering.

/** Replaces the token's server cart wholesale with a resolved, clamped set of lines. */
export async function setCartLines(
  token: string,
  lines: readonly CartLineInput[],
  customerId?: string | null,
): Promise<CartLineInput[]> {
  const { db, tenantId } = requireCartDatabase();
  const variants = await loadVariants(db, tenantId, lines.map((line) => line.variantId));
  const resolved = resolveLines(lines, variants);

  const cart = await getOrCreateCartRow(db, tenantId, token, customerId);
  if (customerId && !cart.customerId) {
    await db.update(carts).set({ customerId, updatedAt: new Date() }).where(eq(carts.id, cart.id));
  }
  await replaceCartItems(db, tenantId, cart.id, resolved, variants);

  return resolved;
}

/**
 * Sign-in merge: combines the shopper's local cart with whatever this cart
 * token already holds server-side, then attaches the cart to the customer.
 * Delegates the actual combine-and-clamp rules to the pure, unit-tested
 * mergeCartLines so the policy lives in one tested place.
 */
export async function mergeCartOnSignIn(
  token: string,
  customerId: string,
  localLines: readonly CartLineInput[],
): Promise<CartLineInput[]> {
  const { db, tenantId } = requireCartDatabase();
  const serverLines = await getCartLines(token);
  const variantIds = [...new Set([...localLines, ...serverLines].map((line) => line.variantId))];
  const variants = await loadVariants(db, tenantId, variantIds);

  const merged = mergeCartLines(localLines, serverLines, (variantId) => {
    const variant = variants.get(variantId);
    return variant
      ? { isAvailable: variant.isAvailable, stockQuantity: variant.stockQuantity, stockPolicy: variant.stockPolicy }
      : undefined;
  });

  const cart = await getOrCreateCartRow(db, tenantId, token, customerId);
  await db.update(carts).set({ customerId, updatedAt: new Date() }).where(eq(carts.id, cart.id));
  await replaceCartItems(db, tenantId, cart.id, merged, variants);

  return merged;
}

/** Clears a cart's items after an order is placed. The cart row itself is reused on the visitor's next visit. */
export async function clearCartByToken(token: string): Promise<void> {
  const { db, tenantId } = requireCartDatabase();
  const cart = await findCartRow(db, tenantId, token);
  if (!cart) return;
  await db.delete(cartItems).where(and(eq(cartItems.tenantId, tenantId), eq(cartItems.cartId, cart.id)));
}
