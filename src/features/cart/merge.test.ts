import { mergeCartLines, type MergeableVariant } from "./merge";

const variants: Record<string, MergeableVariant> = {
  "in-stock": { isAvailable: true, stockQuantity: 10, stockPolicy: "deny" },
  "low-stock": { isAvailable: true, stockQuantity: 2, stockPolicy: "deny" },
  "sold-out": { isAvailable: true, stockQuantity: 0, stockPolicy: "deny" },
  unavailable: { isAvailable: false, stockQuantity: 10, stockPolicy: "deny" },
  backorderable: { isAvailable: true, stockQuantity: 0, stockPolicy: "continue" },
};

function resolve(id: string): MergeableVariant | undefined {
  return variants[id];
}

describe("mergeCartLines", () => {
  it("combines quantities for the same variant on both sides", () => {
    const merged = mergeCartLines(
      [{ productHandle: "tee", variantId: "in-stock", quantity: 2 }],
      [{ productHandle: "tee", variantId: "in-stock", quantity: 3 }],
      resolve,
    );
    expect(merged).toEqual([{ productHandle: "tee", variantId: "in-stock", quantity: 5 }]);
  });

  it("keeps lines that only exist on one side", () => {
    const merged = mergeCartLines(
      [{ productHandle: "tee", variantId: "in-stock", quantity: 1 }],
      [{ productHandle: "shorts", variantId: "low-stock", quantity: 1 }],
      resolve,
    );
    expect(merged).toHaveLength(2);
  });

  it("clamps the combined quantity to available stock", () => {
    const merged = mergeCartLines(
      [{ productHandle: "shorts", variantId: "low-stock", quantity: 5 }],
      [{ productHandle: "shorts", variantId: "low-stock", quantity: 5 }],
      resolve,
    );
    expect(merged).toEqual([{ productHandle: "shorts", variantId: "low-stock", quantity: 2 }]);
  });

  it("drops lines for sold-out or unavailable variants", () => {
    const merged = mergeCartLines(
      [
        { productHandle: "a", variantId: "sold-out", quantity: 1 },
        { productHandle: "b", variantId: "unavailable", quantity: 1 },
      ],
      [],
      resolve,
    );
    expect(merged).toEqual([]);
  });

  it("drops lines whose variant no longer resolves at all", () => {
    const merged = mergeCartLines([{ productHandle: "gone", variantId: "deleted", quantity: 1 }], [], resolve);
    expect(merged).toEqual([]);
  });

  it("allows a backorderable variant to keep its full combined quantity", () => {
    const merged = mergeCartLines(
      [{ productHandle: "pre-order", variantId: "backorderable", quantity: 4 }],
      [{ productHandle: "pre-order", variantId: "backorderable", quantity: 4 }],
      resolve,
    );
    expect(merged).toEqual([{ productHandle: "pre-order", variantId: "backorderable", quantity: 8 }]);
  });

  it("caps a combined quantity at 99", () => {
    const merged = mergeCartLines(
      [{ productHandle: "tee", variantId: "in-stock", quantity: 60 }],
      [{ productHandle: "tee", variantId: "in-stock", quantity: 60 }],
      resolve,
    );
    expect(merged[0].quantity).toBeLessThanOrEqual(99);
  });
});
