import { NegativeStockError, applyStockAdjustment } from "./stock";

describe("applyStockAdjustment", () => {
  it("sets stock to an exact quantity", () => {
    expect(applyStockAdjustment(10, "set", 4)).toBe(4);
  });

  it("adds to the current quantity", () => {
    expect(applyStockAdjustment(10, "add", 5)).toBe(15);
  });

  it("subtracts from the current quantity", () => {
    expect(applyStockAdjustment(10, "subtract", 3)).toBe(7);
  });

  it("allows a subtract that lands exactly on zero", () => {
    expect(applyStockAdjustment(5, "subtract", 5)).toBe(0);
  });

  it("never lets a subtract go negative", () => {
    expect(() => applyStockAdjustment(5, "subtract", 6)).toThrow(NegativeStockError);
  });

  it("never lets a set go negative", () => {
    expect(() => applyStockAdjustment(5, "set", -1)).toThrow(NegativeStockError);
  });
});
