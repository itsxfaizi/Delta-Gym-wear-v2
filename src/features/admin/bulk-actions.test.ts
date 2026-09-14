import { availableTargets, groupSkipReasons, isConsequential, planBulkStatusChange } from "./bulk-actions";

const orders = [
  { id: "1", orderNumber: "DG-1", status: "confirmed" },
  { id: "2", orderNumber: "DG-2", status: "packed" },
  { id: "3", orderNumber: "DG-3", status: "delivered" },
  { id: "4", orderNumber: "DG-4", status: "wat" },
];

describe("planBulkStatusChange", () => {
  it("splits eligible from skipped and explains every skip", () => {
    const plan = planBulkStatusChange(orders, "packed");

    expect(plan.eligible.map((order) => order.id)).toEqual(["1"]);
    expect(plan.skipped.map((order) => order.id)).toEqual(["2", "3", "4"]);
    expect(plan.skipped.every((order) => order.reason.length > 0)).toBe(true);
    expect(plan.summary).toBe("1 of 4 can move to packed; 3 will be skipped.");
  });

  it("never includes an illegal transition", () => {
    expect(planBulkStatusChange(orders, "delivered").eligible).toEqual([]);
  });

  it("reports a clean run honestly", () => {
    expect(planBulkStatusChange([orders[0]], "cancelled").summary).toBe("All 1 selected order can move to cancelled.");
  });
});

describe("availableTargets", () => {
  it("unions the legal next statuses of the selection in lifecycle order", () => {
    expect(availableTargets([orders[0], orders[1]])).toEqual(["packed", "shipped", "cancelled"]);
  });

  it("offers nothing for terminal-only selections", () => {
    expect(availableTargets([orders[2]])).toEqual([]);
  });
});

describe("groupSkipReasons", () => {
  it("collapses repeated reasons", () => {
    const grouped = groupSkipReasons(planBulkStatusChange(orders, "shipped").skipped);
    expect(grouped.reduce((total, group) => total + group.orderNumbers.length, 0)).toBe(3);
  });
});

describe("isConsequential", () => {
  it("guards the moves that are hard to undo", () => {
    expect(isConsequential("cancelled")).toBe(true);
    expect(isConsequential("confirmed")).toBe(false);
  });
});
