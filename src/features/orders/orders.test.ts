import { addressSchema, checkoutLineSchema } from "./schemas";
import {
  ORDER_PRICING,
  calculateOrderTotals,
  canTransition,
  assertTransition,
  InvalidOrderTransitionError,
} from "./orders";
import { buildOrderNumber } from "./order-number";
import { checkoutInputSchema, orderStatusTransitionSchema } from "./schemas";

const line = (unitPriceAmount: number, quantity: number) => ({ unitPriceAmount, quantity });

describe("calculateOrderTotals", () => {
  it("charges flat shipping below the free threshold", () => {
    expect(calculateOrderTotals([line(120_000, 2), line(60_000, 1)])).toEqual({
      subtotalAmount: 300_000,
      shippingAmount: ORDER_PRICING.flatShippingAmount,
      totalAmount: 300_000 + ORDER_PRICING.flatShippingAmount,
    });
  });

  it("waives shipping at and above the threshold", () => {
    const totals = calculateOrderTotals([line(ORDER_PRICING.freeShippingThresholdAmount, 1)]);
    expect(totals).toEqual({
      subtotalAmount: ORDER_PRICING.freeShippingThresholdAmount,
      shippingAmount: 0,
      totalAmount: ORDER_PRICING.freeShippingThresholdAmount,
    });
  });

  it("returns zeroes for an empty cart and honours a custom rule", () => {
    expect(calculateOrderTotals([])).toEqual({ subtotalAmount: 0, shippingAmount: 0, totalAmount: 0 });
    expect(
      calculateOrderTotals([line(1_000, 1)], { flatShippingAmount: 500, freeShippingThresholdAmount: 2_000 }),
    ).toEqual({ subtotalAmount: 1_000, shippingAmount: 500, totalAmount: 1_500 });
  });
});

describe("canTransition", () => {
  it("allows the forward flow and cancellation before shipping", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("packed", "shipped")).toBe(true);
    expect(canTransition("packed", "cancelled")).toBe(true);
  });

  it("rejects skips, reversals and terminal moves", () => {
    expect(canTransition("pending", "shipped")).toBe(false);
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(canTransition("delivered", "confirmed")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(false);
    expect(canTransition("pending", "pending")).toBe(false);
  });

  it("assertTransition throws a typed error naming both statuses", () => {
    expect(() => assertTransition("confirmed", "delivered")).toThrow(InvalidOrderTransitionError);
    expect(() => assertTransition("confirmed", "delivered")).toThrow(/confirmed to delivered/);
    expect(() => assertTransition("confirmed", "packed")).not.toThrow();
  });
});

describe("buildOrderNumber", () => {
  it("is deterministic for the same date and sequence", () => {
    const placedAt = new Date("2026-03-09T21:45:00.000Z");
    expect(buildOrderNumber(placedAt, 7)).toBe("DG-260309-0007");
    expect(buildOrderNumber(placedAt, 7)).toBe(buildOrderNumber(placedAt, 7));
    expect(buildOrderNumber(placedAt, 12345)).toBe("DG-260309-12345");
  });

  it("rejects a non-positive sequence", () => {
    expect(() => buildOrderNumber(new Date(0), 0)).toThrow(RangeError);
  });
});

describe("checkout schemas", () => {
  const validInput = {
    contactEmail: "  Buyer@Example.COM ",
    contactPhone: "0300-123 4567",
    shippingAddress: {
      fullName: "Ayesha Khan",
      phone: "+923001234567",
      line1: "12 Gulberg Main Boulevard",
      line2: "",
      city: "Lahore",
      province: "Punjab",
      postalCode: "54000",
    },
    notes: "",
    lines: [{ productVariantId: "11111111-1111-4111-8111-111111111111", quantity: 2 }],
  };

  it("normalizes email, phone and empty optionals", () => {
    const parsed = checkoutInputSchema.parse(validInput);
    expect(parsed.contactEmail).toBe("buyer@example.com");
    expect(parsed.contactPhone).toBe("03001234567");
    expect(parsed.shippingAddress.line2).toBeNull();
    expect(parsed.shippingAddress.country).toBe("PK");
    expect(parsed.notes).toBeNull();
  });

  it("rejects a non-PK phone, a bad variant id and an empty cart", () => {
    expect(checkoutInputSchema.safeParse({ ...validInput, contactPhone: "0412345678" }).success).toBe(false);
    expect(checkoutInputSchema.safeParse({ ...validInput, lines: [] }).success).toBe(false);
    expect(
      checkoutInputSchema.safeParse({ ...validInput, lines: [{ productVariantId: "", quantity: 1 }] }).success,
    ).toBe(false);
  });

  it("constrains status transitions to known statuses", () => {
    expect(
      orderStatusTransitionSchema.safeParse({
        orderId: "11111111-1111-4111-8111-111111111111",
        nextStatus: "packed",
      }).success,
    ).toBe(true);
    expect(
      orderStatusTransitionSchema.safeParse({
        orderId: "11111111-1111-4111-8111-111111111111",
        nextStatus: "refunded",
      }).success,
    ).toBe(false);
  });
});

describe("addressSchema postal code", () => {
  const address = {
    fullName: "Taha Shek",
    phone: "03001234567",
    line1: "12 Gulberg Main Boulevard",
    city: "Lahore",
    province: "Punjab",
    country: "PK",
  };

  it("accepts a blank optional postal code", () => {
    const parsed = addressSchema.parse({ ...address, postalCode: "" });
    expect(parsed.postalCode).toBeNull();
  });

  it("still rejects a malformed postal code", () => {
    expect(() => addressSchema.parse({ ...address, postalCode: "123" })).toThrow();
  });
});

describe("checkoutLineSchema", () => {
  it("accepts the development seed's slug variant ids", () => {
    expect(checkoutLineSchema.parse({ productVariantId: "dev-ease-black-s", quantity: 1 }).quantity).toBe(1);
  });

  it("still rejects an empty variant id", () => {
    expect(() => checkoutLineSchema.parse({ productVariantId: "", quantity: 1 })).toThrow();
  });
});
