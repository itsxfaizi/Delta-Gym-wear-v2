import { z } from "zod";

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export const productImageRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().min(1).max(MAX_PRODUCT_IMAGE_BYTES),
}).superRefine((value, context) => {
  const extension = value.fileName.toLowerCase().split(".").pop();
  const expected = value.contentType === "image/jpeg" ? ["jpg", "jpeg"]
    : value.contentType === "image/png" ? ["png"] : ["webp"];
  if (!extension || !expected.includes(extension)) {
    context.addIssue({ code: "custom", path: ["fileName"], message: "The file extension does not match its image type." });
  }
});
