import { formatMoney, moneyAmountForStructuredData } from "./money";

describe("catalog money formatting", () => {
  it("formats integer minor units without inventing decimals", () => {
    expect(formatMoney(599_900, "PKR")).toBe("PKR 5,999");
  });

  it("preserves fractional minor units for structured data", () => {
    expect(moneyAmountForStructuredData(599_950)).toBe("5999.50");
  });
});
