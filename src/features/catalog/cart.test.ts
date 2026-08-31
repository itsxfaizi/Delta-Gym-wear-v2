import { restoreCartLines, serializeCartLines } from "./cart";
import { DEVELOPMENT_SEED_PRODUCTS } from "./seed";

describe("browser cart persistence", () => {
  const product = DEVELOPMENT_SEED_PRODUCTS[0];
  const variant = product.variants[0];

  it("restores only bounded identifiers against current published facts", () => {
    expect(restoreCartLines([
      { productHandle: product.handle, variantId: variant.id, quantity: 2, fabricatedPrice: 1 },
      { productHandle: product.handle, variantId: "missing", quantity: 1 },
    ], DEVELOPMENT_SEED_PRODUCTS)).toEqual([
      { key: `${product.handle}:${variant.id}`, product, variant, quantity: 2 },
    ]);
  });

  it("rejects malformed, oversized, and unavailable stored lines", () => {
    expect(restoreCartLines({ lines: [] }, DEVELOPMENT_SEED_PRODUCTS)).toEqual([]);
    expect(restoreCartLines([{ productHandle: product.handle, variantId: variant.id, quantity: 100 }], DEVELOPMENT_SEED_PRODUCTS)).toEqual([]);
    const unavailable = product.variants.find((candidate) => !candidate.isAvailable);
    expect(restoreCartLines([{ productHandle: product.handle, variantId: unavailable?.id, quantity: 1 }], DEVELOPMENT_SEED_PRODUCTS)).toEqual([]);
  });

  it("persists identifiers and quantity rather than product facts", () => {
    const line = { key: `${product.handle}:${variant.id}`, product, variant, quantity: 2 };
    expect(serializeCartLines([line])).toEqual([{ productHandle: product.handle, variantId: variant.id, quantity: 2 }]);
  });
});
