import "server-only";

import { and, eq } from "drizzle-orm";

import type { CartLineInput } from "@/features/catalog/cart";
import { createDatabase, type Database } from "@/server/db";
import { getCatalogTenantId } from "@/server/env";
import { cartItems, carts, productVariants, products, type Cart } from "@/server/db/schema";

export class CartDatabaseUnavailableError extends Error {
  public readonly code = "CART_DATABASE_UNAVAILABLE" as const;

  constructor() {
    super("DATABASE_URL is not configured, so the server cart is unavailable.");
    this.name = "CartDatabaseUnavailableError";
  }
}

/** Every cart path is DB-backed: callers catch this to fall back to the local-only cart. */
export function requireCartDatabase(): { db: Database; tenantId: string } {
  if (!process.env.DATABASE_URL) throw new CartDatabaseUnavailableError();
  return { db: createDatabase(), tenantId: getCatalogTenantId() };
}

export async function findCartRow(db: Database, tenantId: string, token: string): Promise<Cart | null> {
  const [row] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.tenantId, tenantId), eq(carts.token, token)))
    .limit(1);
  return row ?? null;
}

/** Resolves a cart token to its lines, shaped exactly like the localStorage cart payload. */
export async function getCartLines(token: string): Promise<CartLineInput[]> {
  const { db, tenantId } = requireCartDatabase();
  const cart = await findCartRow(db, tenantId, token);
  if (!cart) return [];

  const rows = await db
    .select({
      variantId: cartItems.productVariantId,
      quantity: cartItems.quantity,
      productHandle: products.handle,
    })
    .from(cartItems)
    .innerJoin(
      productVariants,
      and(eq(productVariants.id, cartItems.productVariantId), eq(productVariants.tenantId, tenantId)),
    )
    .innerJoin(
      products,
      and(eq(products.id, productVariants.productId), eq(products.tenantId, tenantId)),
    )
    .where(and(eq(cartItems.tenantId, tenantId), eq(cartItems.cartId, cart.id)));

  return rows.map((row) => ({ productHandle: row.productHandle, variantId: row.variantId, quantity: row.quantity }));
}
