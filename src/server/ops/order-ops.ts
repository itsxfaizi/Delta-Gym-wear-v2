import "server-only";

import { randomUUID } from "node:crypto";

import {
  internalNoteSchema,
  recordCallAttemptSchema,
  setCourierSchema,
  setOpsStatusSchema,
  followUpSchema,
} from "@/features/orders/ops-schemas";
import { canTransition } from "@/features/orders/status";
import { requireAdminPrincipal } from "@/server/admin/guard";
import { requireTenantRole, type AuthenticatedPrincipal } from "@/server/authorization";
import { memoryOrderOpsRepository } from "./store";
import { InvalidOpsTransitionError, type OrderOps } from "./types";

const OPS_WRITER_ROLES = ["owner", "publisher"] as const;

const repository = memoryOrderOpsRepository;

/**
 * Every mutation re-authorizes server-side. A caller may pass a principal it
 * already resolved; otherwise the admin guard resolves one. Either way the role
 * check runs here — never trust the caller.
 */
async function authorize(principal?: AuthenticatedPrincipal | null): Promise<AuthenticatedPrincipal> {
  if (principal) return requireTenantRole(principal, OPS_WRITER_ROLES);
  return requireAdminPrincipal(OPS_WRITER_ROLES);
}

/** Read path: unauthorized-safe, returns an empty record for unknown orders. */
export async function getOrderOps(orderId: string): Promise<OrderOps> {
  return repository.get(orderId);
}

export async function recordCallAttempt(
  orderId: string,
  input: unknown,
  principal?: AuthenticatedPrincipal | null,
): Promise<OrderOps> {
  await authorize(principal);
  const parsed = recordCallAttemptSchema.parse({ ...(input as object), orderId });
  const notedAt = new Date();

  return repository.upsert(parsed.orderId, (current) => ({
    ...current,
    callAttempts: [
      ...current.callAttempts,
      {
        id: randomUUID(),
        outcome: parsed.outcome,
        notedAt,
        ...(parsed.note ? { note: parsed.note } : {}),
      },
    ],
    lastAttemptAt: notedAt,
    nextFollowUpAt: parsed.nextFollowUpAt ?? current.nextFollowUpAt,
  }));
}

export async function setFollowUp(
  orderId: string,
  input: unknown,
  principal?: AuthenticatedPrincipal | null,
): Promise<OrderOps> {
  await authorize(principal);
  const parsed = followUpSchema.parse({ ...(input as object), orderId });

  return repository.upsert(parsed.orderId, (current) => ({
    ...current,
    nextFollowUpAt: parsed.nextFollowUpAt,
  }));
}

export async function setCourier(
  orderId: string,
  input: unknown,
  principal?: AuthenticatedPrincipal | null,
): Promise<OrderOps> {
  await authorize(principal);
  const parsed = setCourierSchema.parse({ ...(input as object), orderId });

  return repository.upsert(parsed.orderId, (current) => ({
    ...current,
    courier: parsed.courier,
    trackingNumber: parsed.trackingNumber,
    ...(parsed.trackingUrl ? { trackingUrl: parsed.trackingUrl } : { trackingUrl: undefined }),
    dispatchedAt: parsed.dispatchedAt ?? current.dispatchedAt ?? new Date(),
  }));
}

export async function appendInternalNote(
  orderId: string,
  input: unknown,
  principal?: AuthenticatedPrincipal | null,
): Promise<OrderOps> {
  const actor = await authorize(principal);
  const parsed = internalNoteSchema.parse({ ...(input as object), orderId });

  return repository.upsert(parsed.orderId, (current) => ({
    ...current,
    internalNotes: [
      ...current.internalNotes,
      { id: randomUUID(), body: parsed.body, authorUserId: actor.userId, notedAt: new Date() },
    ],
  }));
}

export async function setOpsStatus(
  orderId: string,
  input: unknown,
  principal?: AuthenticatedPrincipal | null,
): Promise<OrderOps> {
  await authorize(principal);
  const parsed = setOpsStatusSchema.parse({ ...(input as object), orderId });

  return repository.upsert(parsed.orderId, (current) => {
    // Only enforceable once ops owns the status; the DB column is still the
    // source of truth for the first move, so an unset opsStatus is accepted.
    if (current.opsStatus && !canTransition(current.opsStatus, parsed.status)) {
      throw new InvalidOpsTransitionError(current.opsStatus, parsed.status);
    }
    return { ...current, opsStatus: parsed.status };
  });
}

/**
 * The effective COD status of an order: the ops adapter wins over the DB column,
 * because confirmation_required / refused / returned_to_sender cannot be stored
 * in the order_status enum at all. Every surface that shows a status uses this —
 * never the raw column — or the same order reads differently on two screens.
 */
export async function resolveCodStatus(orderId: string, dbStatus: string): Promise<string> {
  const ops = await getOrderOps(orderId);
  return ops.opsStatus ?? dbStatus;
}

export async function resolveCodStatuses<T extends { id: string; status: string }>(
  rows: readonly T[],
): Promise<(Omit<T, "status"> & { status: string })[]> {
  return Promise.all(
    rows.map(async (row) => ({ ...row, status: await resolveCodStatus(row.id, row.status) })),
  );
}
