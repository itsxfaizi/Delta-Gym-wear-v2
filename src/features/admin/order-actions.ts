"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { InvalidOrderTransitionError } from "@/features/orders/orders";
import {
  ORDER_STATUS_META,
  canTransition,
  isCodStatus,
  persistableStatus,
  type CodStatus,
} from "@/features/orders/status";
import { requireAdminPrincipal } from "@/server/admin/guard";
import { AuthorizationError } from "@/server/authorization";
import {
  appendInternalNote,
  getOrderOps,
  recordCallAttempt,
  setCourier,
  setOpsStatus,
} from "@/server/ops/order-ops";
import { InvalidOpsTransitionError } from "@/server/ops/types";
import { OrderNotFoundError, updateOrderStatus } from "@/server/orders/mutations";
import { OrdersDatabaseUnavailableError, getOrderById } from "@/server/orders/queries";

import type { ActionResult } from "./schemas";

/** Ops writes are owner/publisher work, not catalog-editor work. */
const OPS_WRITER_ROLES = ["owner", "publisher"] as const;

function toResult(error: unknown): ActionResult {
  if (error instanceof AuthorizationError) {
    return { ok: false, message: "You do not have permission to do that." };
  }
  // Only human-written errors are echoed; a driver error would leak schema names.
  if (
    error instanceof InvalidOpsTransitionError ||
    error instanceof InvalidOrderTransitionError ||
    error instanceof OrderNotFoundError ||
    error instanceof ZodError
  ) {
    return { ok: false, message: error.message };
  }
  console.error("admin order action failed", error);
  return { ok: false, message: "That did not work. Please try again." };
}

function revalidateOrder(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

/** The DB status, or null when there is no database to read it from. */
async function readDatabaseStatus(orderId: string): Promise<string | null> {
  try {
    const order = await getOrderById(orderId);
    return order?.status ?? null;
  } catch (error) {
    if (error instanceof OrdersDatabaseUnavailableError) return null;
    throw error;
  }
}

export async function moveOrderStatus(orderId: string, nextStatus: string): Promise<ActionResult> {
  try {
    const principal = await requireAdminPrincipal(OPS_WRITER_ROLES);
    if (!isCodStatus(nextStatus)) return { ok: false, message: "That status does not exist." };

    const ops = await getOrderOps(orderId);
    const databaseStatus = await readDatabaseStatus(orderId);
    const current = ops.opsStatus ?? databaseStatus;

    // Never trust the client's idea of where the order is: re-derive and re-check.
    if (!current || !isCodStatus(current)) {
      return { ok: false, message: "This order has no known status to move from." };
    }
    if (!canTransition(current, nextStatus)) {
      return {
        ok: false,
        message: `An order cannot move from ${ORDER_STATUS_META[current].label} to ${ORDER_STATUS_META[nextStatus].label}.`,
      };
    }

    const persisted = persistableStatus(nextStatus);
    if (databaseStatus && databaseStatus !== persisted) {
      await updateOrderStatus(orderId, persisted, principal);
    }
    await setOpsStatus(orderId, { orderId, status: nextStatus satisfies CodStatus }, principal);

    revalidateOrder(orderId);
    return { ok: true, id: orderId };
  } catch (error) {
    return toResult(error);
  }
}

export async function recordCall(orderId: string, input: unknown): Promise<ActionResult> {
  try {
    const principal = await requireAdminPrincipal(OPS_WRITER_ROLES);
    await recordCallAttempt(orderId, input, principal);
    revalidateOrder(orderId);
    return { ok: true, id: orderId };
  } catch (error) {
    return toResult(error);
  }
}

export async function saveCourier(orderId: string, input: unknown): Promise<ActionResult> {
  try {
    const principal = await requireAdminPrincipal(OPS_WRITER_ROLES);
    await setCourier(orderId, input, principal);
    revalidateOrder(orderId);
    return { ok: true, id: orderId };
  } catch (error) {
    return toResult(error);
  }
}

export async function addInternalNote(orderId: string, input: unknown): Promise<ActionResult> {
  try {
    const principal = await requireAdminPrincipal(OPS_WRITER_ROLES);
    await appendInternalNote(orderId, input, principal);
    revalidateOrder(orderId);
    return { ok: true, id: orderId };
  } catch (error) {
    return toResult(error);
  }
}
