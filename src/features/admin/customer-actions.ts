"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { planBulkStatusChange } from "@/features/admin/bulk-actions";
import { PRODUCT_PUBLISHER_ROLES } from "@/features/admin/schemas";
import type { AuthenticatedPrincipal } from "@/server/authorization";
import {
  COD_STATUSES,
  ORDER_STATUS_META,
  canTransitionOrderStatus,
  persistableStatus,
  type CodStatus,
} from "@/features/orders/status";
import { requireAdminPrincipal } from "@/server/admin/guard";
import { AuthorizationError } from "@/server/authorization";
import { getOrderOps, setOpsStatus } from "@/server/ops/order-ops";
import { updateOrderStatus } from "@/server/orders/mutations";
import { OrdersDatabaseUnavailableError, getOrderById } from "@/server/orders/queries";

export type BulkOrderResult = {
  orderId: string;
  orderNumber: string;
  ok: boolean;
  message: string;
};

export type BulkChangeResult = {
  ok: boolean;
  message: string;
  results: BulkOrderResult[];
};

const bulkInputSchema = z.object({
  // Not .uuid(): admin lists render derived ids without a database, matching ops-schemas.ts.
  orderIds: z.array(z.string().trim().min(1).max(128)).min(1, "Select at least one order.").max(100),
  target: z.enum(COD_STATUSES),
});

function failure(message: string): BulkChangeResult {
  return { ok: false, message, results: [] };
}

/**
 * Bulk status change. Eligibility is re-computed per order on the server from
 * the order's own current status, so an illegal transition is reported, never
 * forced and never silently dropped.
 */
export async function bulkChangeOrderStatus(rawInput: unknown): Promise<BulkChangeResult> {
  let target: CodStatus;
  let orderIds: string[];
  let principal: AuthenticatedPrincipal;
  try {
    const parsed = bulkInputSchema.parse(rawInput);
    target = parsed.target;
    orderIds = [...new Set(parsed.orderIds)];
    // Same writer roles as every other ops mutation; ADMIN_ROLES let a read-only
    // auditor through the outer gate and fail once per order instead.
    principal = await requireAdminPrincipal(PRODUCT_PUBLISHER_ROLES);
  } catch (error) {
    if (error instanceof AuthorizationError) return failure("You do not have permission to do that.");
    if (error instanceof z.ZodError) return failure(error.issues[0]?.message ?? "That selection is not valid.");
    console.error("bulk status change rejected", error);
    return failure("That did not work. Please try again.");
  }

  const label = ORDER_STATUS_META[target].label.toLowerCase();
  const results: BulkOrderResult[] = [];

  for (const orderId of orderIds) {
    results.push(await moveOne(orderId, target, label, principal));
  }

  revalidatePath("/admin/orders");
  const moved = results.filter((result) => result.ok).length;
  return {
    ok: moved > 0,
    message:
      moved === 0
        ? `No orders moved to ${label}.`
        : `${moved} of ${results.length} moved to ${label}.`,
    results,
  };
}

async function moveOne(
  orderId: string,
  target: CodStatus,
  label: string,
  principal: AuthenticatedPrincipal,
): Promise<BulkOrderResult> {

  try {
    const order = await getOrderById(orderId);
    if (!order) return { orderId, orderNumber: orderId, ok: false, message: "Order not found." };

    const ops = await getOrderOps(orderId);
    const current = ops.opsStatus ?? order.status;
    const plan = planBulkStatusChange([{ id: order.id, orderNumber: order.orderNumber, status: current }], target);
    const skipped = plan.skipped[0];
    if (skipped) return { orderId, orderNumber: order.orderNumber, ok: false, message: skipped.reason };

    const dbTarget = persistableStatus(target);
    const movedInDb = dbTarget !== order.status && canTransitionOrderStatus(order.status, dbTarget);
    if (movedInDb) await updateOrderStatus(orderId, dbTarget, principal);
    await setOpsStatus(orderId, { status: target }, principal);

    return {
      orderId,
      orderNumber: order.orderNumber,
      ok: true,
      message: movedInDb ? `Moved to ${label}.` : `Moved to ${label} (ops only; the stored status stays ${order.status}).`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { orderId, orderNumber: orderId, ok: false, message: "You do not have permission to do that." };
    }
    if (error instanceof OrdersDatabaseUnavailableError) {
      return { orderId, orderNumber: orderId, ok: false, message: "No database is configured, so nothing was written." };
    }
    console.error("bulk status change failed", { orderId, target }, error);
    return { orderId, orderNumber: orderId, ok: false, message: "That did not work. Please try again." };
  }
}
