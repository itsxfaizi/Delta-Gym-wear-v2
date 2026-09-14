import {
  RISK_MIN_SAMPLE,
  customerKeyFor,
  deriveCustomers,
  normalisePhone,
  riskSignal,
  searchCustomers,
  type CustomerOrderInput,
} from "./customers";

function order(overrides: Partial<CustomerOrderInput> & { id: string }): CustomerOrderInput {
  return {
    orderNumber: `DG-${overrides.id}`,
    customerId: null,
    contactEmail: "ali@example.com",
    contactPhone: "0300 1234567",
    shippingAddress: { fullName: "Ali Raza", city: "Lahore", province: "Punjab", line1: "1 Mall Rd", line2: null },
    status: "delivered",
    totalAmount: 1000,
    currency: "PKR",
    placedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("normalisePhone", () => {
  it("treats local and +92 forms as the same number", () => {
    expect(normalisePhone("+92 300 1234567")).toBe(normalisePhone("0300-1234567"));
  });
});

describe("customerKeyFor", () => {
  it("keys signed-in customers by id and guests by phone", () => {
    expect(customerKeyFor(order({ id: "1", customerId: "cus_9" }))).toBe("c_cus_9");
    expect(customerKeyFor(order({ id: "1" }))).toBe("g_3001234567");
  });
});

describe("deriveCustomers", () => {
  it("groups guest orders on the same phone and derives every metric", () => {
    const [record] = deriveCustomers([
      order({ id: "1", status: "delivered", totalAmount: 1000, placedAt: new Date("2026-01-01") }),
      order({ id: "2", status: "refused", totalAmount: 500, placedAt: new Date("2026-02-01") }),
      order({ id: "3", status: "pending", totalAmount: 200, placedAt: new Date("2026-03-01"), contactPhone: "+923001234567" }),
    ]);

    expect(record.isGuest).toBe(true);
    expect(record.orderCount).toBe(3);
    expect(record.totalOrderedAmount).toBe(1700);
    expect(record.deliveredCount).toBe(1);
    expect(record.deliveredAmount).toBe(1000);
    expect(record.refusedCount).toBe(1);
    expect(record.failedCount).toBe(1);
    expect(record.lastOrderAt).toEqual(new Date("2026-03-01"));
  });

  it("keeps a signed-in customer separate from a guest on the same phone", () => {
    const records = deriveCustomers([order({ id: "1", customerId: "cus_1" }), order({ id: "2" })]);
    expect(records).toHaveLength(2);
  });
});

describe("riskSignal", () => {
  it("stays unknown below the minimum sample", () => {
    expect(riskSignal({ deliveredCount: 0, failedCount: RISK_MIN_SAMPLE - 1 }).level).toBe("unknown");
  });

  it("grades watch and high by the failed share", () => {
    expect(riskSignal({ deliveredCount: 3, failedCount: 1 }).level).toBe("watch");
    expect(riskSignal({ deliveredCount: 2, failedCount: 2 }).level).toBe("high");
    expect(riskSignal({ deliveredCount: 10, failedCount: 0 }).level).toBe("ok");
  });
});

describe("searchCustomers", () => {
  const records = deriveCustomers([order({ id: "1", orderNumber: "DG-1001" })]);

  it.each(["ali", "ALI@EXAMPLE.COM", "dg-1001", "+92 300 1234567"])("matches %s", (query) => {
    expect(searchCustomers(records, query)).toHaveLength(1);
  });

  it("returns nothing for a miss", () => {
    expect(searchCustomers(records, "zainab")).toHaveLength(0);
  });
});
