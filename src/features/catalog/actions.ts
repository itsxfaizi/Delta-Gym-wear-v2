"use server";

import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Result } from "../result";
import {
  PRODUCT_STATUSES,
  canTransitionProductStatus,
  getProductStatusTransition,
  type ProductStatus,
} from "./types";
import { TENANT_ROLES, requireTenantRole, type TenantRole } from "@/server/authorization";
import { resolveTenantPrincipal, type TenantPrincipal } from "@/server/authorization/principal";
import { createDatabase, type Database } from "@/server/db";
import { auditEvents, products } from "@/server/db/schema";
import { log } from "@/server/observability/logger";
import { getRequestId } from "@/server/observability/request-id";

/**
 * The one privileged mutation (contract C).
 *
 * THERE IS NO UI CALLER AND NONE IS PLANNED THIS PASS. Admin screens are blocked
 * on decision O-002, so nothing in `src/app/**` imports this file; only the unit
 * tests do. That is deliberate: the guarded, audited mutation layer ships first
 * and the screen is wired to it once the frames are approved. Because nothing in
 * the route graph imports it, the "use server" directive registers no reachable
 * action endpoint in a build - it declares the intended calling convention.
 */

const transitionInputSchema = z.object({
  productId: z.string().uuid(),
  to: z.enum(PRODUCT_STATUSES),
  expectedRevisionId: z.string().uuid(),
});

type TransitionInput = z.infer<typeof transitionInputSchema>;

type TransitionData = { productId: string; status: ProductStatus; revisionId: string };

/** Every message a caller can see. None reveals existence, ownership or role. */
const MESSAGES = {
  unauthenticated: "Sign in with an account that has access to this catalog.",
  forbidden: "You cannot make this change.",
  notFound: "That product is not available.",
  validation: "The request was not valid.",
  unsupported: "This product cannot move to that status from its current one.",
  stale: "This product changed since you loaded it. Reload it and try again.",
  server: "The change could not be saved. Please try again.",
} as const;

/**
 * `requireTenantRole` is the codebase's fail-closed authorization primitive and
 * it throws; this boundary returns Results, so both checks below route through
 * this adapter rather than re-implementing the role comparison.
 */
function holdsRole(principal: TenantPrincipal, allowed: readonly TenantRole[]): boolean {
  try {
    requireTenantRole(
      {
        userId: principal.userId,
        tenantId: principal.tenantId,
        membership: { role: principal.role, status: principal.status },
      },
      allowed,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Roles that could perform SOME approved transition into `to`. This is the only
 * authorization possible before the row is read, because the approved table is
 * keyed on `from -> to` and `from` lives in the database. Both this and the
 * exact check below are derived from the single table in `./types`, so the
 * matrix is never written down twice.
 */
function rolesThatCanReach(to: ProductStatus): readonly TenantRole[] {
  return TENANT_ROLES.filter((role) =>
    PRODUCT_STATUSES.some((from) => canTransitionProductStatus(from, to, role)),
  );
}

function rolesFor(from: ProductStatus, to: ProductStatus): readonly TenantRole[] {
  return TENANT_ROLES.filter((role) => canTransitionProductStatus(from, to, role));
}

/**
 * Contract D. One row per privileged mutation attempt, and only ever for an
 * authenticated principal: an anonymous caller cannot be attributed, and an
 * anonymous endpoint that writes a row per request is a denial-of-service
 * amplifier. `before` is the status observed at the time of the attempt and is
 * null when the attempt was refused before the row was read; `after` is the
 * requested target. Neither carries any other column.
 */
async function writeAuditEvent(
  executor: Pick<Database, "insert">,
  principal: TenantPrincipal,
  input: TransitionInput,
  outcome: "success" | "denied" | "conflict",
  before: ProductStatus | null,
): Promise<void> {
  const requestId = await getRequestId();

  await executor.insert(auditEvents).values({
    tenantId: principal.tenantId,
    actorUserId: principal.userId,
    action: "product.status_transition",
    targetType: "product",
    targetId: input.productId,
    requestId,
    // Contract D allows a caller-supplied correlation id "when one exists".
    // Contract C's input has no field to carry one, so the request id is it.
    correlationId: requestId,
    outcome,
    before: before === null ? null : { status: before },
    after: { status: input.to },
  });
}

/**
 * Ordering is contract C and is not negotiable: validate -> resolve principal ->
 * authorize -> open transaction -> re-read the row under the transaction ->
 * check the expected revision -> update -> insert the audit row -> commit.
 */
export async function transitionProductStatus(input: {
  productId: string;
  to: ProductStatus;
  expectedRevisionId: string;
}): Promise<Result<TransitionData>> {
  // 1. Validate, before any authorization work and before any database call.
  const parsed = transitionInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join(".") || "input"] ??= []).push(issue.message);
    }
    return { ok: false, code: "VALIDATION", message: MESSAGES.validation, fieldErrors };
  }
  const request = parsed.data;

  // 2. Resolve the principal. No principal means no tenant to attribute a row
  // to, so this path writes no audit event.
  const principal = await resolveTenantPrincipal();
  if (!principal) return { ok: false, code: "UNAUTHENTICATED", message: MESSAGES.unauthenticated };

  try {
    const database = createDatabase();

    // 3. Authorize. Refusing here, before any read, is what keeps FORBIDDEN
    // non-disclosing: a role that can never reach `to` gets the same answer for
    // a product that exists, one in another tenant, and one that never existed.
    if (!holdsRole(principal, rolesThatCanReach(request.to))) {
      await writeAuditEvent(database, principal, request, "denied", null);
      return { ok: false, code: "FORBIDDEN", message: MESSAGES.forbidden };
    }

    // 4. One transaction for the read, the update and the audit row.
    return await database.transaction(async (transaction) => {
      // 5. Re-read under the transaction, tenant-scoped, and lock the row: the
      // status read here is what the update is authorized against, so nothing
      // may move it in between. The tenant filter comes from the principal and
      // is the reason a cross-tenant id is indistinguishable from a missing one.
      const [row] = await transaction
        .select({ status: products.status, currentRevisionId: products.currentRevisionId })
        .from(products)
        .where(and(eq(products.tenantId, principal.tenantId), eq(products.id, request.productId)))
        .limit(1)
        .for("update");

      // Returning an Err from inside the transaction COMMITS the audit row it
      // just wrote, which is the point. Never throw on a refusal here: throwing
      // rolls the transaction back and loses the evidence of the attempt.
      if (!row) {
        await writeAuditEvent(transaction, principal, request, "denied", null);
        return { ok: false, code: "NOT_FOUND", message: MESSAGES.notFound };
      }

      const transition = getProductStatusTransition(row.status, request.to);
      if (!transition) {
        await writeAuditEvent(transaction, principal, request, "conflict", row.status);
        return { ok: false, code: "CONFLICT", message: MESSAGES.unsupported };
      }

      // 6. The exact rule. This refines step 3, it does not replace it: the
      // approved table is keyed on `from -> to` and `from` was unknown until the
      // read above. Role first, revision second - a caller who may not make the
      // change at all is refused before its concurrency token is even examined.
      if (!holdsRole(principal, rolesFor(row.status, request.to))) {
        await writeAuditEvent(transaction, principal, request, "denied", row.status);
        return { ok: false, code: "FORBIDDEN", message: MESSAGES.forbidden };
      }

      // 7. Optimistic concurrency. A product whose `current_revision_id` is null
      // can never match a uuid, so it fails closed rather than transitioning on
      // an unverifiable token.
      if (row.currentRevisionId !== request.expectedRevisionId) {
        await writeAuditEvent(transaction, principal, request, "conflict", row.status);
        return { ok: false, code: "CONFLICT", message: MESSAGES.stale };
      }

      // 8. Update, tenant-scoped again so the write cannot be wider than the read.
      await transaction
        .update(products)
        .set({ status: request.to, updatedAt: new Date() })
        .where(and(eq(products.tenantId, principal.tenantId), eq(products.id, request.productId)));

      // 9. Audit inside the same transaction. If this insert fails the status
      // update rolls back with it: an unaudited transition is not a transition.
      await writeAuditEvent(transaction, principal, request, "success", row.status);

      // A status transition does not create a revision, so the caller's token is
      // still the current one and is echoed back rather than re-read.
      return {
        ok: true,
        data: {
          productId: request.productId,
          status: request.to,
          revisionId: request.expectedRevisionId,
        },
      };
    });
  } catch (error) {
    // The exception never crosses the boundary. It is logged server-side, where
    // a SQL fragment is diagnostics rather than disclosure.
    log("error", "product.status_transition.failed", {
      requestId: await getRequestId(),
      productId: request.productId,
      to: request.to,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, code: "SERVER", message: MESSAGES.server };
  }
}
