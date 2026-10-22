"use server";

import { randomUUID } from "node:crypto";

import { PRODUCT_EDITOR_ROLES } from "@/features/admin/schemas";
import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { requireAdminPrincipal } from "@/server/admin/guard";
import { createDatabase } from "@/server/db";
import { auditEvents, productImageObjects } from "@/server/db/schema";

import { PRODUCT_IMAGE_BUCKET, productImageRequestSchema } from "./media-upload";

type ImageUploadResult =
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; message: string };

/** Grants a short-lived upload token for one new, tenant-scoped object. */
export async function prepareProductImageUpload(rawInput: unknown): Promise<ImageUploadResult> {
  const parsed = productImageRequestSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Choose a valid image." };

  try {
    const actor = await requireAdminPrincipal(PRODUCT_EDITOR_ROLES);
    const extension = parsed.data.fileName.toLowerCase().split(".").pop()!;
    const imageId = randomUUID();
    const path = `${actor.tenantId}/${imageId}.${extension}`;
    const storage = createSupabaseServiceClient().storage.from(PRODUCT_IMAGE_BUCKET);
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("No upload token returned");
    if (data.path !== path) throw new Error("Unexpected signed upload path");
    const publicUrl = storage.getPublicUrl(data.path).data.publicUrl;

    // A never-attached upload is eligible 30 days after issuance. Product saves
    // clear/reset this timestamp as references are added or removed.
    await createDatabase().insert(productImageObjects).values({
      tenantId: actor.tenantId,
      objectPath: data.path,
      publicUrl,
      unreferencedAt: new Date(),
    });

    // This records token issuance. The browser uploads the bytes separately, so
    // neither this event nor a public URL proves that an image was uploaded.
    await createDatabase().insert(auditEvents).values({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "product_image.upload_token_issued",
      targetType: "product_image",
      targetId: imageId,
      requestId: randomUUID(),
      outcome: "success",
      before: null,
      after: { path: data.path, contentType: parsed.data.contentType, declaredSize: parsed.data.size },
    });

    return { ok: true, path: data.path, token: data.token, publicUrl };
  } catch (error) {
    console.error("Product image upload could not be prepared", error);
    return { ok: false, message: "The image upload is unavailable. Please try again." };
  }
}
