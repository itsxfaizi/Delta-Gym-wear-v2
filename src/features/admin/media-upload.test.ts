import { MAX_PRODUCT_IMAGE_BYTES, productImageRequestSchema } from "./media-upload";

describe("product image upload request", () => {
  it("accepts a bounded image whose extension matches the MIME type", () => {
    expect(productImageRequestSchema.safeParse({ fileName: "front.webp", contentType: "image/webp", size: MAX_PRODUCT_IMAGE_BYTES }).success).toBe(true);
  });

  it("rejects unsupported, mismatched, and oversize uploads before signing", () => {
    expect(productImageRequestSchema.safeParse({ fileName: "vector.svg", contentType: "image/svg+xml", size: 100 }).success).toBe(false);
    expect(productImageRequestSchema.safeParse({ fileName: "front.jpg", contentType: "image/png", size: 100 }).success).toBe(false);
    expect(productImageRequestSchema.safeParse({ fileName: "front.png", contentType: "image/png", size: MAX_PRODUCT_IMAGE_BYTES + 1 }).success).toBe(false);
  });
});
