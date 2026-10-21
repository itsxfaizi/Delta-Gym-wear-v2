import "server-only";

import { and, eq } from "drizzle-orm";

import { promotionInputSchema, promotionUpdateSchema } from "@/features/promotions/schemas";
import { requireTenantRole, type AuthenticatedPrincipal } from "@/server/authorization";
import { auditEvents, promoCodes } from "@/server/db/schema";
import { requireOrdersDatabase } from "@/server/orders/queries";

export class PromotionNotFoundError extends Error {
  constructor() { super("Promo code was not found."); this.name = "PromotionNotFoundError"; }
}

export async function createPromotion(rawInput: unknown, principal: AuthenticatedPrincipal | null) {
  const actor = requireTenantRole(principal, ["owner"]);
  const input = promotionInputSchema.parse(rawInput);
  const { db, tenantId } = requireOrdersDatabase();
  if (actor.tenantId !== tenantId) throw new PromotionNotFoundError();
  const now = new Date();
  if (input.expiresAt <= now) throw new Error("Expiry must be in the future.");

  return db.transaction(async (tx) => {
    const [created] = await tx.insert(promoCodes).values({ tenantId, ...input })
      .returning({ id: promoCodes.id });
    await tx.insert(auditEvents).values({
      tenantId, actorUserId: actor.userId, action: "promotion.created",
      targetType: "promo_code", targetId: created.id, outcome: "success",
      requestId: crypto.randomUUID(),
      after: { code: input.code, kind: input.kind, value: input.value, expiresAt: input.expiresAt.toISOString(), usageLimit: input.usageLimit, active: input.active },
    });
    return created.id;
  });
}

export async function updatePromotion(rawInput: unknown, principal: AuthenticatedPrincipal | null) {
  const actor = requireTenantRole(principal, ["owner"]);
  const input = promotionUpdateSchema.parse(rawInput);
  const { db, tenantId } = requireOrdersDatabase();
  if (actor.tenantId !== tenantId) throw new PromotionNotFoundError();
  return db.transaction(async (tx) => {
    const [previous] = await tx.select().from(promoCodes)
      .where(and(eq(promoCodes.tenantId, tenantId), eq(promoCodes.id, input.id)))
      .limit(1).for("update");
    if (!previous) throw new PromotionNotFoundError();
    if (input.usageLimit < previous.usageCount) throw new Error("Usage limit cannot be below the number already redeemed.");
    if (input.active && input.expiresAt <= new Date()) throw new Error("An active promo code needs a future expiry.");
    const { id, ...fields } = input;
    await tx.update(promoCodes).set({ ...fields, updatedAt: new Date() })
      .where(and(eq(promoCodes.tenantId, tenantId), eq(promoCodes.id, id)));
    await tx.insert(auditEvents).values({
      tenantId, actorUserId: actor.userId, action: "promotion.updated",
      targetType: "promo_code", targetId: id, outcome: "success",
      requestId: crypto.randomUUID(),
      before: { code: previous.code, kind: previous.kind, value: previous.value, expiresAt: previous.expiresAt.toISOString(), usageLimit: previous.usageLimit, active: previous.active },
      after: { code: input.code, kind: input.kind, value: input.value, expiresAt: input.expiresAt.toISOString(), usageLimit: input.usageLimit, active: input.active },
    });
  });
}

export async function setPromotionActive(id: string, active: boolean, principal: AuthenticatedPrincipal | null) {
  const actor = requireTenantRole(principal, ["owner"]);
  const { db, tenantId } = requireOrdersDatabase();
  if (actor.tenantId !== tenantId) throw new PromotionNotFoundError();
  return db.transaction(async (tx) => {
    const [previous] = await tx.select().from(promoCodes)
      .where(and(eq(promoCodes.tenantId, tenantId), eq(promoCodes.id, id)))
      .limit(1).for("update");
    if (!previous) throw new PromotionNotFoundError();
    if (active && previous.expiresAt <= new Date()) throw new Error("An expired promo code cannot be activated.");
    await tx.update(promoCodes).set({ active, updatedAt: new Date() })
      .where(and(eq(promoCodes.tenantId, tenantId), eq(promoCodes.id, id)));
    await tx.insert(auditEvents).values({
      tenantId, actorUserId: actor.userId, action: active ? "promotion.activated" : "promotion.disabled",
      targetType: "promo_code", targetId: id, outcome: "success",
      requestId: crypto.randomUUID(),
      before: { active: previous.active }, after: { active },
    });
  });
}
