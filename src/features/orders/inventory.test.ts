import { OutOfStockError, assertSufficientStock, type StockVariant } from "./inventory";

const variants: readonly StockVariant[] = [
  { id: "a", sku: "SKU-a", stockQuantity: 3, stockPolicy: "deny" },
  { id: "b", sku: "SKU-b", stockQuantity: 0, stockPolicy: "continue" },
  { id: "c", sku: "SKU-c", stockQuantity: 10, stockPolicy: "deny" },
];

describe("assertSufficientStock", () => {
  it("passes when every line is covered", () => {
    expect(() =>
      assertSufficientStock([{ productVariantId: "a", quantity: 3 }, { productVariantId: "c", quantity: 1 }], variants),
    ).not.toThrow();
  });

  it("allows backorders on continue-policy variants", () => {
    expect(() => assertSufficientStock([{ productVariantId: "b", quantity: 99 }], variants)).not.toThrow();
  });

  it("throws OutOfStockError naming every offending variant", () => {
    let thrown: OutOfStockError | null = null;
    try {
      assertSufficientStock(
        [
          { productVariantId: "a", quantity: 4 },
          { productVariantId: "c", quantity: 1 },
          { productVariantId: "missing", quantity: 2 },
        ],
        variants,
      );
    } catch (error) {
      thrown = error as OutOfStockError;
    }

    expect(thrown).toBeInstanceOf(OutOfStockError);
    expect(thrown?.code).toBe("OUT_OF_STOCK");
    expect(thrown?.shortfalls).toEqual([
      { productVariantId: "a", sku: "SKU-a", requested: 4, available: 3 },
      { productVariantId: "missing", sku: null, requested: 2, available: 0 },
    ]);
    expect(thrown?.message).toContain("SKU-a");
  });
});
