import "server-only";

import { and, eq, notInArray, sql } from "drizzle-orm";

import { PRODUCT_EDITOR_ROLES, PRODUCT_PUBLISHER_ROLES, productFormSchema, type ProductFormInput, type ProductStatus } from "@/features/admin/schemas";
import { ORDER_PRICING } from "@/features/orders/orders";
import type { AuthenticatedPrincipal } from "@/server/authorization";
import { createDatabase, type Database } from "@/server/db";
import { auditEvents, mediaReferences, productRevisions, productVariants, products } from "@/server/db/schema";
import { requireAdminPrincipal } from "./guard";

export class AdminDatabaseUnavailableError extends Error {
  public readonly code = "ADMIN_DATABASE_UNAVAILABLE" as const;

  constructor() {
    super("DATABASE_URL is not configured, so admin writes are disabled.");
    this.name = "AdminDatabaseUnavailableError";
  }
}

export class ProductNotFoundError extends Error {
  public readonly code = "PRODUCT_NOT_FOUND" as const;

  constructor(productId: string) {
    super(`Product ${productId} was not found.`);
    this.name = "ProductNotFoundError";
  }
}

function adminDatabase(): { db: Database } {
  if (!process.env.DATABASE_URL) throw new AdminDatabaseUnavailableError();
  return { db: createDatabase() };
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Every product mutation leaves a revision snapshot and an audit trail behind. */
async function recordMutation(
  tx: Tx,
  actor: AuthenticatedPrincipal,
  input: {
    productId: string;
    status: ProductStatus;
    action: string;
    snapshot: Record<string, unknown>;
    before: Record<string, unknown> | null;
  },
): Promise<void> {
  const [previous] = await tx
    .select({ revisionNumber: productRevisions.revisionNumber })
    .from(productRevisions)
    .where(
      and(eq(productRevisions.tenantId, actor.tenantId), eq(productRevisions.productId, input.productId)),
    )
    .orderBy(sql`${productRevisions.revisionNumber} desc`)
    .limit(1);

  const revisionNumber = (previous?.revisionNumber ?? 0) + 1;

  const [revision] = await tx
    .insert(productRevisions)
    .values({
      tenantId: actor.tenantId,
      productId: input.productId,
      revisionNumber,
      status: input.status,
      snapshot: input.snapshot,
      authorUserId: actor.userId,
    })
    .returning({ id: productRevisions.id });

  await tx
    .update(products)
    .set({ currentRevisionId: revision.id, version: revisionNumber, updatedAt: new Date() })
    .where(and(eq(products.tenantId, actor.tenantId), eq(products.id, input.productId)));

  await tx.insert(auditEvents).values({
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: input.action,
    targetType: "product",
    targetId: input.productId,
    outcome: "success",
    before: input.before,
    after: input.snapshot,
  });
}

/**
 * Variants are never deleted — order and cart rows point at them — so a variant
 * dropped from the form is retired by making it unavailable instead.
 */
async function syncVariants(tx: Tx, tenantId: string, productId: string, parsed: ProductFormInput) {
  const keptIds: string[] = [];

  for (const variant of parsed.variants) {
    const values = {
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      priceAmount: variant.priceAmount,
      compareAtPriceAmount: variant.compareAtPriceAmount,
      currency: ORDER_PRICING.currency,
      isAvailable: variant.isAvailable,
      stockQuantity: variant.stockQuantity,
      stockPolicy: variant.stockPolicy,
      updatedAt: new Date(),
    };

    if (variant.id) {
      await tx
        .update(productVariants)
        .set(values)
        .where(
          and(
            eq(productVariants.tenantId, tenantId),
            eq(productVariants.productId, productId),
            eq(productVariants.id, variant.id),
          ),
        );
      keptIds.push(variant.id);
      continue;
    }

    const [inserted] = await tx
      .insert(productVariants)
      .values({ tenantId, productId, ...values })
      .returning({ id: productVariants.id });
    keptIds.push(inserted.id);
  }

  await tx
    .update(productVariants)
    .set({ isAvailable: false, updatedAt: new Date() })
    .where(
      and(
        eq(productVariants.tenantId, tenantId),
        eq(productVariants.productId, productId),
        keptIds.length ? notInArray(productVariants.id, keptIds) : undefined,
      ),
    );
}

/** Media has no dependents, so the form is the whole truth for it. */
async function syncMedia(tx: Tx, tenantId: string, productId: string, parsed: ProductFormInput) {
  const keys = parsed.media.map((item) => item.objectKey);

  await tx
    .delete(mediaReferences)
    .where(
      and(
        eq(mediaReferences.tenantId, tenantId),
        eq(mediaReferences.productId, productId),
        keys.length ? notInArray(mediaReferences.objectKey, keys) : undefined,
      ),
    );

  for (const item of parsed.media) {
    await tx
      .insert(mediaReferences)
      .values({ tenantId, productId, objectKey: item.objectKey, altText: item.altText })
      .onConflictDoUpdate({
        target: [mediaReferences.tenantId, mediaReferences.objectKey],
        set: { productId, altText: item.altText, updatedAt: new Date() },
      });
  }
}

const PUBLISHED_STATUSES: readonly ProductStatus[] = ["published", "archived"];

/** Publishing (or archiving) is a publisher-grade act; plain edits are not. */
async function authorizeForStatus(status: ProductStatus): Promise<AuthenticatedPrincipal> {
  return requireAdminPrincipal(
    PUBLISHED_STATUSES.includes(status) ? PRODUCT_PUBLISHER_ROLES : PRODUCT_EDITOR_ROLES,
  );
}

export async function createProduct(input: unknown): Promise<string> {
  const parsed = productFormSchema.parse(input);
  const actor = await authorizeForStatus(parsed.status);
  const { db } = adminDatabase();

  return db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        tenantId: actor.tenantId,
        handle: parsed.handle,
        title: parsed.title,
        description: parsed.description,
        status: parsed.status,
      })
      .returning({ id: products.id });

    await syncVariants(tx, actor.tenantId, product.id, parsed);
    await syncMedia(tx, actor.tenantId, product.id, parsed);
    await recordMutation(tx, actor, {
      productId: product.id,
      status: parsed.status,
      action: "product.created",
      snapshot: parsed,
      before: null,
    });

    return product.id;
  });
}

export async function updateProduct(input: unknown): Promise<string> {
  const parsed = productFormSchema.parse(input);
  if (!parsed.id) throw new ProductNotFoundError("(missing id)");
  const productId = parsed.id;
  const actor = await authorizeForStatus(parsed.status);
  const { db } = adminDatabase();

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(products)
      .where(and(eq(products.tenantId, actor.tenantId), eq(products.id, productId)))
      .limit(1)
      .for("update");
    if (!current) throw new ProductNotFoundError(productId);

    await tx
      .update(products)
      .set({
        handle: parsed.handle,
        title: parsed.title,
        description: parsed.description,
        status: parsed.status,
        updatedAt: new Date(),
      })
      .where(and(eq(products.tenantId, actor.tenantId), eq(products.id, productId)));

    await syncVariants(tx, actor.tenantId, productId, parsed);
    await syncMedia(tx, actor.tenantId, productId, parsed);
    await recordMutation(tx, actor, {
      productId,
      status: parsed.status,
      action: "product.updated",
      snapshot: parsed,
      before: { title: current.title, handle: current.handle, status: current.status },
    });
  });

  return productId;
}

/** Publish / unpublish / archive without round-tripping the whole form. */
export async function setProductStatus(productId: string, status: ProductStatus): Promise<string> {
  const actor = await requireAdminPrincipal(PRODUCT_PUBLISHER_ROLES);
  const { db } = adminDatabase();

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(products)
      .where(and(eq(products.tenantId, actor.tenantId), eq(products.id, productId)))
      .limit(1)
      .for("update");
    if (!current) throw new ProductNotFoundError(productId);

    await tx
      .update(products)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(products.tenantId, actor.tenantId), eq(products.id, productId)));

    await recordMutation(tx, actor, {
      productId,
      status,
      action: `product.${status}`,
      snapshot: { id: productId, title: current.title, handle: current.handle, status },
      before: { status: current.status },
    });
  });

  return productId;
}
