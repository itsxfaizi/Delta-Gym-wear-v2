"use server";

import { adjustVariantStock as adjustVariantStockOnServer } from "@/server/admin/stock";

import type { ActionResult } from "./schemas";

/**
 * Client boundary for stock adjustment. Authorization, validation, the guarded
 * update and the audit row all live in src/server/admin/stock.ts — this only
 * makes it callable from a client component without pulling the database driver
 * into the browser bundle.
 */
export async function adjustVariantStockAction(
  variantId: string,
  rawInput: unknown,
): Promise<ActionResult & { stockQuantity?: number }> {
  return adjustVariantStockOnServer(variantId, rawInput);
}
