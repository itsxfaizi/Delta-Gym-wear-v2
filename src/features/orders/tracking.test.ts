import {
  TRACKING_JOURNEY,
  normalizeOrderNumber,
  normalizePhone,
  orderTrackingSchema,
  phonesMatch,
  trackingTimeline,
} from "./tracking";

describe("normalizeOrderNumber", () => {
  it("trims and upper-cases so a pasted receipt number matches", () => {
    expect(normalizeOrderNumber("  dg-240131-0001 ")).toBe("DG-240131-0001");
  });
});

describe("phonesMatch", () => {
  it("treats local and international spellings of one line as equal", () => {
    expect(phonesMatch("03285386793", "+92 328-5386793")).toBe(true);
    expect(normalizePhone("+92 328-5386793")).toBe("923285386793");
  });

  it("rejects a different line and anything too short to be a number", () => {
    expect(phonesMatch("03285386793", "03001234567")).toBe(false);
    expect(phonesMatch("12345", "12345")).toBe(false);
  });
});

describe("orderTrackingSchema", () => {
  it("normalizes a valid pair", () => {
    const parsed = orderTrackingSchema.parse({ orderNumber: " dg-240131-0001", phone: "0328 5386793" });
    expect(parsed.orderNumber).toBe("DG-240131-0001");
  });

  it("rejects junk in either field", () => {
    expect(orderTrackingSchema.safeParse({ orderNumber: "a", phone: "0328 5386793" }).success).toBe(false);
    expect(orderTrackingSchema.safeParse({ orderNumber: "DG-1", phone: "nope" }).success).toBe(false);
  });
});

describe("trackingTimeline", () => {
  it("marks the journey before, at and after the current status", () => {
    const steps = trackingTimeline("packed");
    expect(steps.map((step) => step.state)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
    expect(steps).toHaveLength(TRACKING_JOURNEY.length);
  });

  it("hangs an exception ending off the journey it reached", () => {
    const refused = trackingTimeline("refused");
    expect(refused.at(-1)).toMatchObject({ status: "refused", state: "current" });
    // refused happens after the parcel shipped, so shipping is shown as done.
    expect(refused.map((step) => step.status)).toEqual(["pending", "confirmed", "packed", "shipped", "refused"]);

    expect(trackingTimeline("cancelled").map((step) => step.status)).toEqual(["pending", "cancelled"]);
  });

  it("never throws on a status the UI has not heard of", () => {
    const steps = trackingTimeline("teleported");
    expect(steps).toEqual([
      { status: "teleported", meta: expect.objectContaining({ label: "teleported" }), state: "current" },
    ]);
  });
});
