import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, isNull, lte } from "drizzle-orm";

import { PRODUCT_IMAGE_BUCKET } from "@/features/admin/media-upload";
import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { createDatabase } from "@/server/db";
import { auditEvents, mediaReferences, productImageObjects } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";

export const PRODUCT_IMAGE_RETENTION_DAYS = 30;
const MAX_OBJECTS_PER_RUN = 25;

type CleanupResult = { eligible: number; deleted: number; referenced: number; failed: number; dryRun: boolean };

/** Runs against one configured tenant and one bucket; a dry run never mutates either system. */
export async function cleanupUnreferencedProductImages(
  { dryRun = false, now = new Date() }: { dryRun?: boolean; now?: Date } = {},
): Promise<CleanupResult> {
  const tenantId = getCatalogTenantId();
  const cutoff = new Date(now.getTime() - PRODUCT_IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const db = createDatabase();
  const candidates = await db.select({ objectPath: productImageObjects.objectPath })
    .from(productImageObjects)
    .where(and(
      eq(productImageObjects.tenantId, tenantId),
      isNull(productImageObjects.deletedAt),
      lte(productImageObjects.unreferencedAt, cutoff),
    ))
    .orderBy(asc(productImageObjects.unreferencedAt), asc(productImageObjects.objectPath))
    .limit(MAX_OBJECTS_PER_RUN);

  const result: CleanupResult = { eligible: candidates.length, deleted: 0, referenced: 0, failed: 0, dryRun };
  for (const candidate of candidates) {
    const outcome = await db.transaction(async (tx) => {
      const [image] = await tx.select().from(productImageObjects)
        .where(and(eq(productImageObjects.tenantId, tenantId), eq(productImageObjects.objectPath, candidate.objectPath)))
        .limit(1).for("update");
      if (!image || image.deletedAt || !image.unreferencedAt || image.unreferencedAt > cutoff) return "skipped";

      const [reference] = await tx.select({ id: mediaReferences.id }).from(mediaReferences)
        .where(and(eq(mediaReferences.tenantId, tenantId), eq(mediaReferences.objectKey, image.publicUrl)))
        .limit(1);
      if (reference) {
        if (!dryRun) await tx.update(productImageObjects).set({ unreferencedAt: null })
          .where(and(eq(productImageObjects.tenantId, tenantId), eq(productImageObjects.objectPath, image.objectPath)));
        return "referenced";
      }
      if (dryRun) return "eligible";

      const requestId = randomUUID();
      const imageId = image.objectPath.slice(tenantId.length + 1).split(".")[0];
      const audit = { tenantId, actorUserId: null, action: "product_image.cleanup", targetType: "product_image", targetId: imageId, requestId };
      // The intent is written before the irreversible Storage API call. Both
      // records commit together if the database remains available.
      await tx.insert(auditEvents).values({ ...audit, outcome: "attempted", before: { bucket: PRODUCT_IMAGE_BUCKET, path: image.objectPath }, after: null });

      let storageError: string | null = null;
      try {
        const { error } = await createSupabaseServiceClient().storage.from(PRODUCT_IMAGE_BUCKET).remove([image.objectPath]);
        if (error) storageError = error.message;
      } catch (error) {
        storageError = error instanceof Error ? error.message : "Storage request failed";
      }
      if (storageError) {
        await tx.insert(auditEvents).values({ ...audit, outcome: "failure", before: null, after: { reason: "storage_remove_failed" } });
        console.error("Product image cleanup failed", { requestId, path: image.objectPath, error: storageError });
        return "failed";
      }

      await tx.update(productImageObjects).set({ deletedAt: now })
        .where(and(eq(productImageObjects.tenantId, tenantId), eq(productImageObjects.objectPath, image.objectPath)));
      await tx.insert(auditEvents).values({ ...audit, outcome: "success", before: null, after: { deletedAt: now.toISOString() } });
      return "deleted";
    });
    if (outcome === "deleted") result.deleted++;
    if (outcome === "referenced") result.referenced++;
    if (outcome === "failed") result.failed++;
  }
  return result;
}
