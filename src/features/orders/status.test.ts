import {
  COD_STATUSES,
  COD_STATUS_FLOW,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_META,
  canTransition,
  describeStatus,
  isCodStatus,
  isTerminal,
  nextStatuses,
  persistableStatus,
  type CodStatus,
} from "./status";

const TERMINAL: CodStatus[] = ["delivered", "refused", "returned_to_sender", "cancelled"];

describe("COD_STATUS_FLOW", () => {
  it("allows every declared transition", () => {
    for (const from of COD_STATUSES) {
      for (const to of COD_STATUS_FLOW[from]) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it("rejects transitions that are not declared", () => {
    for (const from of COD_STATUSES) {
      const legal = new Set<string>(COD_STATUS_FLOW[from]);
      for (const to of COD_STATUSES) {
        if (legal.has(to)) continue;
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it("never lets a status transition to itself", () => {
    for (const status of COD_STATUSES) expect(canTransition(status, status)).toBe(false);
  });

  it("gives shipped all three real endings", () => {
    expect([...nextStatuses("shipped")].sort()).toEqual([
      "delivered",
      "refused",
      "returned_to_sender",
    ]);
  });

  it("leaves terminal statuses with no successors", () => {
    for (const status of COD_STATUSES) {
      expect(isTerminal(status)).toBe(TERMINAL.includes(status));
      if (isTerminal(status)) expect(nextStatuses(status)).toHaveLength(0);
    }
  });

  it("stays a superset of the persisted DB flow", () => {
    for (const [from, targets] of Object.entries(ORDER_STATUS_FLOW)) {
      for (const to of targets) {
        expect(canTransition(from as CodStatus, to)).toBe(true);
      }
    }
  });

  it("reaches every non-initial status from pending", () => {
    const seen = new Set<CodStatus>(["pending"]);
    const queue: CodStatus[] = ["pending"];
    while (queue.length > 0) {
      for (const next of nextStatuses(queue.pop()!)) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    expect([...seen].sort()).toEqual([...COD_STATUSES].sort());
  });
});

describe("describeStatus", () => {
  it("describes every known status", () => {
    for (const status of COD_STATUSES) {
      const meta = describeStatus(status);
      expect(meta).toMatchObject({ ...ORDER_STATUS_META[status], status, known: true });
    }
  });

  it("falls back safely on unknown and legacy values", () => {
    for (const value of ["awaiting_payment", "", "DELIVERED", "null"]) {
      const meta = describeStatus(value);
      expect(meta.known).toBe(false);
      expect(meta.tone).toBe("neutral");
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
      expect(isCodStatus(value)).toBe(false);
    }
  });

  it("does not inherit keys from Object.prototype", () => {
    expect(isCodStatus("toString")).toBe(false);
    expect(describeStatus("constructor").known).toBe(false);
  });
});

describe("persistableStatus", () => {
  it("keeps persistable statuses unchanged", () => {
    for (const status of COD_STATUSES) {
      if (ORDER_STATUS_META[status].persistable) expect(persistableStatus(status)).toBe(status);
    }
  });

  it("maps the three unsupported statuses onto the nearest DB enum value", () => {
    expect(persistableStatus("confirmation_required")).toBe("pending");
    expect(persistableStatus("refused")).toBe("shipped");
    expect(persistableStatus("returned_to_sender")).toBe("shipped");
  });
});
