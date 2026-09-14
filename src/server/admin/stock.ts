import "server-only";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { PRODUCT_EDITOR_ROLES, type ActionResult } from "@/features/admin/schemas";
import { NegativeStockError, applyStockAdjustment, stockAdjustmentSchema } from "@/features/admin/stock";
import { AuthorizationError } from "@/server/authorization";
import { createDatabase } from "@/server/db";
import { auditEvents, productVariants } from "@/server/db/schema";
import { requireAdminPrincipal } from "./guard";

export class VariantNotFoundError extends Error {
  public readonly code = "VARIANT_NOT_FOUND" as const;

  constructor(variantId: string) {
    super(`Variant ${variantId} was not found.`);
    this.name = "VariantNotFoundError";
  }
}

function toResult(error: unknown): ActionResult {
  if (error instanceof AuthorizationError) {
    return { ok: false, message: "You do not have permission to do that." };
  }
  if (error instanceof NegativeStockError || error instanceof VariantNotFoundError || error instanceof ZodError) {
    return { ok: false, message: error.message };
  }
  console.error("stock adjustment failed", error);
  return { ok: false, message: "That did not work. Please try again." };
}

/**
 * Server Action: authorizes, re-derives the current quantity inside the
 * transaction (never trusts a client-computed "next" value), and leaves an
 * audit trail. Client components reach it through
 * src/features/admin/stock-actions.ts, never by importing this module.
 */
export async function adjustVariantStock(
  variantId: string,
  rawInput: unknown,
): Promise<ActionResult & { stockQuantity?: number }> {
  try {
    const input = stockAdjustmentSchema.parse(rawInput);
    const actor = await requireAdminPrincipal(PRODUCT_EDITOR_ROLES);
    const db = createDatabase();

    const { stockQuantity, productId } = await db.transaction(async (tx) => {
      const [variant] = await tx
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          sku: productVariants.sku,
          stockQuantity: productVariants.stockQuantity,
        })
        .from(productVariants)
        .where(and(eq(productVariants.tenantId, actor.tenantId), eq(productVariants.id, variantId)))
        .limit(1)
        .for("update");

      if (!variant) throw new VariantNotFoundError(variantId);

      const nextQuantity = applyStockAdjustment(variant.stockQuantity, input.mode, input.amount);

      await tx
        .update(productVariants)
        .set({ stockQuantity: nextQuantity, updatedAt: new Date() })
        .where(and(eq(productVariants.tenantId, actor.tenantId), eq(productVariants.id, variantId)));

      await tx.insert(auditEvents).values({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "variant.stock_adjusted",
        targetType: "product_variant",
        targetId: variantId,
        outcome: "success",
        before: { sku: variant.sku, stockQuantity: variant.stockQuantity },
        after: {
          sku: variant.sku,
          stockQuantity: nextQuantity,
          mode: input.mode,
          amount: input.amount,
          reason: input.reason,
        },
      });

      return { stockQuantity: nextQuantity, productId: variant.productId };
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/admin");
    return { ok: true, id: variantId, stockQuantity };
  } catch (error) {
    return toResult(error);
  }
}
