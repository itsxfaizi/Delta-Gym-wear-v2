import { formatMoney, formatMoneyAmount, roundMinorUnits } from "./money";

describe("formatMoney", () => {
  it("defaults to PKR", () => {
    expect(formatMoney(599_900)).toBe("PKR 5,999");
  });

  it("formats zero without decimals", () => {
    expect(formatMoney(0)).toBe("PKR 0");
  });

  it("keeps fractional minor units", () => {
    expect(formatMoney(599_950)).toBe("PKR 5,999.50");
  });

  it("groups large values", () => {
    expect(formatMoney(1_234_567_800)).toBe("PKR 12,345,678");
  });

  it("formats negative amounts (refunds)", () => {
    expect(formatMoney(-45_000)).toBe("PKR -450");
  });

  it("honours an explicit currency", () => {
    expect(formatMoney(10_000, "USD")).toBe("USD 100");
  });
});

describe("roundMinorUnits", () => {
  it("rounds fractional minor units half-up", () => {
    expect(roundMinorUnits(10.5)).toBe(11);
    expect(roundMinorUnits(10.4)).toBe(10);
  });

  it("rejects non-finite amounts", () => {
    expect(() => roundMinorUnits(Number.NaN)).toThrow(RangeError);
    expect(() => roundMinorUnits(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("formatMoneyAmount", () => {
  it("emits a decimal major-unit string", () => {
    expect(formatMoneyAmount(599_950)).toBe("5999.50");
    expect(formatMoneyAmount(0)).toBe("0.00");
  });
});
