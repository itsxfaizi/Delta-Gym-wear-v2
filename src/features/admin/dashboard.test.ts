import {
  averageOrderValue,
  bucketOrdersByDay,
  countAwaitingConfirmation,
  countOrdersByStatus,
  deliveryOutcomes,
  isLowStock,
  percentChange,
  splitByPeriod,
  sumOrderRevenue,
  topSellingProducts,
} from "./dashboard";

describe("countOrdersByStatus", () => {
  it("reports every status, including the empty ones", () => {
    expect(countOrdersByStatus([{ status: "pending" }, { status: "pending" }, { status: "shipped" }])).toEqual({
      pending: 2,
      confirmed: 0,
      packed: 0,
      shipped: 1,
      delivered: 0,
      cancelled: 0,
    });
  });
});

describe("sumOrderRevenue", () => {
  it("excludes cancelled orders", () => {
    expect(
      sumOrderRevenue([
        { status: "delivered", totalAmount: 500 },
        { status: "cancelled", totalAmount: 900 },
        { status: "pending", totalAmount: 100 },
      ]),
    ).toBe(600);
  });
});

describe("isLowStock", () => {
  it("flags tracked variants at or below the threshold", () => {
    expect(isLowStock({ stockQuantity: 5, stockPolicy: "deny" })).toBe(true);
    expect(isLowStock({ stockQuantity: 6, stockPolicy: "deny" })).toBe(false);
  });

  it("never flags backorderable variants", () => {
    expect(isLowStock({ stockQuantity: 0, stockPolicy: "continue" })).toBe(false);
  });
});

describe("averageOrderValue", () => {
  it("ignores orders that can never collect cash", () => {
    expect(
      averageOrderValue([
        { status: "delivered", totalAmount: 500 },
        { status: "refused", totalAmount: 900 },
        { status: "cancelled", totalAmount: 900 },
        { status: "pending", totalAmount: 300 },
      ]),
    ).toBe(400);
  });

  it("is zero, not NaN, with no orders", () => {
    expect(averageOrderValue([])).toBe(0);
  });
});

describe("deliveryOutcomes", () => {
  it("rates delivered against every settled attempt", () => {
    const outcomes = deliveryOutcomes([
      { status: "delivered" },
      { status: "delivered" },
      { status: "delivered" },
      { status: "refused" },
      { status: "shipped" },
    ]);
    expect(outcomes).toMatchObject({ delivered: 3, failed: 1, settled: 4, deliveryRate: 0.75, refusalRate: 0.25 });
  });

  it("returns null rates rather than inventing 0% when nothing settled", () => {
    expect(deliveryOutcomes([{ status: "pending" }])).toMatchObject({ deliveryRate: null, refusalRate: null });
  });
});

describe("countAwaitingConfirmation", () => {
  it("counts both pre-confirmation states", () => {
    expect(
      countAwaitingConfirmation([
        { status: "pending" },
        { status: "confirmation_required" },
        { status: "confirmed" },
      ]),
    ).toBe(2);
  });
});

describe("percentChange", () => {
  it("is null without a prior period", () => {
    expect(percentChange(10, 0)).toBeNull();
  });

  it("reports the relative move", () => {
    expect(percentChange(150, 100)).toBeCloseTo(0.5);
    expect(percentChange(50, 100)).toBeCloseTo(-0.5);
  });
});

describe("splitByPeriod", () => {
  const now = new Date("2026-02-10T12:00:00.000Z");
  const at = (iso: string) => ({ placedAt: new Date(iso) });

  it("splits the window from the equally long window before it", () => {
    const { current, prior } = splitByPeriod(
      [at("2026-02-10T01:00:00Z"), at("2026-02-05T00:00:00Z"), at("2026-01-30T00:00:00Z"), at("2025-12-01T00:00:00Z")],
      7,
      now,
    );
    expect(current).toHaveLength(2);
    expect(prior).toHaveLength(1);
  });
});

describe("bucketOrdersByDay", () => {
  const now = new Date("2026-02-10T12:00:00.000Z");

  it("zero-fills every day of the window, oldest first", () => {
    const buckets = bucketOrdersByDay([], 3, now);
    expect(buckets.map((bucket) => bucket.date)).toEqual(["2026-02-08", "2026-02-09", "2026-02-10"]);
    expect(buckets.every((bucket) => bucket.revenue === 0 && bucket.orders === 0)).toBe(true);
  });

  it("counts orders on their day and keeps failed parcels out of revenue", () => {
    const buckets = bucketOrdersByDay(
      [
        { status: "delivered", totalAmount: 1000, placedAt: new Date("2026-02-09T08:00:00Z") },
        { status: "refused", totalAmount: 900, placedAt: new Date("2026-02-09T20:00:00Z") },
        { status: "pending", totalAmount: 500, placedAt: new Date("2026-02-10T00:30:00Z") },
        { status: "delivered", totalAmount: 700, placedAt: new Date("2025-11-01T00:00:00Z") },
      ],
      3,
      now,
    );
    // Buckets are Karachi days: 2026-02-09T20:00Z is 01:00 on the 10th locally, and
    // 2026-02-10T00:30Z is 05:30 the same morning. Both belong to the 10th.
    expect(buckets[1]).toMatchObject({ date: "2026-02-09", orders: 1, revenue: 1000, delivered: 1, failed: 0 });
    expect(buckets[2]).toMatchObject({ date: "2026-02-10", orders: 2, revenue: 500, failed: 1 });
  });
});

describe("topSellingProducts", () => {
  it("groups by title, ranks by units, and keeps a linkable product id", () => {
    expect(
      topSellingProducts(
        [
          { productId: null, productTitle: "Tee", quantity: 2, lineTotalAmount: 400 },
          { productId: "p1", productTitle: "Tee", quantity: 3, lineTotalAmount: 600 },
          { productId: "p2", productTitle: "Shorts", quantity: 4, lineTotalAmount: 1600 },
        ],
        2,
      ),
    ).toEqual([
      { productId: "p1", productTitle: "Tee", quantity: 5, revenue: 1000 },
      { productId: "p2", productTitle: "Shorts", quantity: 4, revenue: 1600 },
    ]);
  });
});
