import { isVariantPurchasable, lowStockLabel, maxPurchasableQuantity } from "./stock";
import type { CatalogVariant } from "./types";

function variant(overrides: Partial<CatalogVariant> = {}): CatalogVariant {
  return {
    id: "v1",
    sku: "SKU-1",
    color: "Black",
    size: "M",
    priceAmount: 599900,
    compareAtPriceAmount: null,
    currency: "PKR",
    isAvailable: true,
    stockQuantity: 3,
    stockPolicy: "deny",
    ...overrides,
  };
}

describe("isVariantPurchasable", () => {
  it("allows in-stock variants", () => {
    expect(isVariantPurchasable(variant())).toBe(true);
  });

  it("blocks unavailable variants regardless of stock", () => {
    expect(isVariantPurchasable(variant({ isAvailable: false, stockQuantity: 99 }))).toBe(false);
    expect(isVariantPurchasable(variant({ isAvailable: false, stockPolicy: "continue" }))).toBe(false);
  });

  it("blocks sold-out variants when the policy denies backorder", () => {
    expect(isVariantPurchasable(variant({ stockQuantity: 0 }))).toBe(false);
  });

  it("allows sold-out variants when the policy continues", () => {
    expect(isVariantPurchasable(variant({ stockQuantity: 0, stockPolicy: "continue" }))).toBe(true);
  });

  it("treats an absent stockQuantity as untracked", () => {
    expect(isVariantPurchasable(variant({ stockQuantity: undefined }))).toBe(true);
  });
});

describe("maxPurchasableQuantity", () => {
  it("caps the request at tracked stock under a deny policy", () => {
    expect(maxPurchasableQuantity(variant({ stockQuantity: 3 }), 10)).toBe(3);
    expect(maxPurchasableQuantity(variant({ stockQuantity: 3 }), 2)).toBe(2);
  });

  it("does not cap a backorderable variant", () => {
    expect(maxPurchasableQuantity(variant({ stockQuantity: 0, stockPolicy: "continue" }), 10)).toBe(10);
  });

  it("returns zero for unpurchasable variants", () => {
    expect(maxPurchasableQuantity(variant({ stockQuantity: 0 }), 5)).toBe(0);
    expect(maxPurchasableQuantity(variant({ isAvailable: false }), 5)).toBe(0);
  });

  it("normalizes junk requests", () => {
    expect(maxPurchasableQuantity(variant(), 0)).toBe(0);
    expect(maxPurchasableQuantity(variant(), -4)).toBe(0);
    expect(maxPurchasableQuantity(variant(), 1.9)).toBe(1);
    expect(maxPurchasableQuantity(variant(), Number.NaN)).toBe(0);
  });

  it("does not cap untracked stock", () => {
    expect(maxPurchasableQuantity(variant({ stockQuantity: undefined }), 50)).toBe(50);
  });
});

describe("lowStockLabel", () => {
  it("warns at or below the threshold", () => {
    expect(lowStockLabel(variant({ stockQuantity: 3 }), 5)).toBe("Only 3 left");
    expect(lowStockLabel(variant({ stockQuantity: 5 }), 5)).toBe("Only 5 left");
  });

  it("stays silent above the threshold", () => {
    expect(lowStockLabel(variant({ stockQuantity: 6 }), 5)).toBeNull();
  });

  it("stays silent for backorderable, untracked, or unpurchasable variants", () => {
    expect(lowStockLabel(variant({ stockQuantity: 1, stockPolicy: "continue" }))).toBeNull();
    expect(lowStockLabel(variant({ stockQuantity: undefined }))).toBeNull();
    expect(lowStockLabel(variant({ stockQuantity: 0 }))).toBeNull();
    expect(lowStockLabel(variant({ isAvailable: false, stockQuantity: 2 }))).toBeNull();
  });

  it("uses a default threshold", () => {
    expect(lowStockLabel(variant({ stockQuantity: 5 }))).toBe("Only 5 left");
    expect(lowStockLabel(variant({ stockQuantity: 9 }))).toBeNull();
  });
});
