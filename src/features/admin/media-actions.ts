"use server";

import { randomUUID } from "node:crypto";

import { PRODUCT_EDITOR_ROLES } from "@/features/admin/schemas";
import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { requireAdminPrincipal } from "@/server/admin/guard";

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
    const path = `${actor.tenantId}/${randomUUID()}.${extension}`;
    const storage = createSupabaseServiceClient().storage.from(PRODUCT_IMAGE_BUCKET);
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("No upload token returned");

    return { ok: true, path: data.path, token: data.token, publicUrl: storage.getPublicUrl(data.path).data.publicUrl };
  } catch (error) {
    console.error("Product image upload could not be prepared", error);
    return { ok: false, message: "The image upload is unavailable. Please try again." };
  }
}
