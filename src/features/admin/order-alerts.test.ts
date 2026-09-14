import { alertTitle, countNewOrders, describeAlert, type OrderAlertSnapshot } from "./order-alerts";

const snapshot = (latestPlacedAt: string | null, total: number): OrderAlertSnapshot => ({
  latestPlacedAt,
  total,
  pendingConfirmation: 0,
});

describe("countNewOrders", () => {
  it("is zero before a baseline exists", () => {
    expect(countNewOrders(null, snapshot("2026-09-14T10:00:00Z", 5))).toBe(0);
  });

  it("is zero while the newest order is unchanged", () => {
    const same = snapshot("2026-09-14T10:00:00Z", 5);
    expect(countNewOrders(same, same)).toBe(0);
  });

  it("counts the difference once a newer order lands", () => {
    expect(
      countNewOrders(snapshot("2026-09-14T10:00:00Z", 5), snapshot("2026-09-14T10:05:00Z", 8)),
    ).toBe(3);
  });

  it("never reports a negative count when orders are removed", () => {
    expect(
      countNewOrders(snapshot("2026-09-14T10:00:00Z", 5), snapshot("2026-09-14T10:05:00Z", 4)),
    ).toBe(0);
  });

  it("stays silent when there are no orders at all", () => {
    expect(countNewOrders(snapshot(null, 0), snapshot(null, 0))).toBe(0);
  });
});

describe("alertTitle", () => {
  it("prefixes the count so a background tab shows it", () => {
    expect(alertTitle(3, "Orders — Delta admin")).toBe("(3) Orders — Delta admin");
  });

  it("leaves the title alone when nothing is new", () => {
    expect(alertTitle(0, "Orders — Delta admin")).toBe("Orders — Delta admin");
  });
});

describe("describeAlert", () => {
  it("reads naturally for one and many", () => {
    expect(describeAlert(1)).toBe("1 new order");
    expect(describeAlert(4)).toBe("4 new orders");
    expect(describeAlert(0)).toBe("");
  });
});
