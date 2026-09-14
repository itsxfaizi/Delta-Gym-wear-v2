import {
  CALL_OUTCOMES,
  followUpSchema,
  internalNoteSchema,
  recordCallAttemptSchema,
  setCourierSchema,
  setOpsStatusSchema,
} from "./ops-schemas";

const HOUR = 60 * 60 * 1000;
const future = () => new Date(Date.now() + HOUR);
const past = () => new Date(Date.now() - HOUR);

describe("recordCallAttemptSchema", () => {
  it("accepts every call outcome", () => {
    for (const outcome of CALL_OUTCOMES) {
      const parsed = recordCallAttemptSchema.parse({ orderId: "order-1", outcome });
      expect(parsed).toEqual({
        orderId: "order-1",
        outcome,
        note: null,
        nextFollowUpAt: null,
      });
    }
  });

  it("rejects an unknown outcome", () => {
    expect(recordCallAttemptSchema.safeParse({ orderId: "o", outcome: "maybe" }).success).toBe(false);
  });

  it("trims a note and blanks it when empty", () => {
    expect(recordCallAttemptSchema.parse({ orderId: "o", outcome: "no_answer", note: "  ring later " }).note)
      .toBe("ring later");
    expect(recordCallAttemptSchema.parse({ orderId: "o", outcome: "no_answer", note: "   " }).note).toBeNull();
  });

  it("coerces an ISO follow-up string into a future Date", () => {
    const at = future();
    const parsed = recordCallAttemptSchema.parse({
      orderId: "o",
      outcome: "callback_requested",
      nextFollowUpAt: at.toISOString(),
    });
    expect(parsed.nextFollowUpAt).toEqual(at);
  });

  it("rejects a follow-up in the past", () => {
    const result = recordCallAttemptSchema.safeParse({
      orderId: "o",
      outcome: "callback_requested",
      nextFollowUpAt: past(),
    });
    expect(result.success).toBe(false);
  });

  it("requires an order id", () => {
    expect(recordCallAttemptSchema.safeParse({ orderId: "  ", outcome: "confirmed" }).success).toBe(false);
  });
});

describe("followUpSchema", () => {
  it("accepts a future date and clears with null", () => {
    const at = future();
    expect(followUpSchema.parse({ orderId: "o", nextFollowUpAt: at }).nextFollowUpAt).toEqual(at);
    expect(followUpSchema.parse({ orderId: "o", nextFollowUpAt: null }).nextFollowUpAt).toBeNull();
  });

  it("rejects a past date", () => {
    expect(followUpSchema.safeParse({ orderId: "o", nextFollowUpAt: past() }).success).toBe(false);
  });
});

describe("internalNoteSchema", () => {
  it("trims the body", () => {
    expect(internalNoteSchema.parse({ orderId: "o", body: "  called twice  " }).body).toBe("called twice");
  });

  it("rejects an empty or oversized body", () => {
    expect(internalNoteSchema.safeParse({ orderId: "o", body: "   " }).success).toBe(false);
    expect(internalNoteSchema.safeParse({ orderId: "o", body: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("setCourierSchema", () => {
  const base = { orderId: "o", courier: "Leopards", trackingNumber: "LE-123456789" };

  it("accepts a courier with a real tracking URL", () => {
    const parsed = setCourierSchema.parse({
      ...base,
      trackingUrl: "https://leopardscourier.com/tracking?cn=LE-123456789",
    });
    expect(parsed.trackingUrl).toBe("https://leopardscourier.com/tracking?cn=LE-123456789");
    expect(parsed.dispatchedAt).toBeNull();
  });

  it("treats a missing tracking URL as null", () => {
    expect(setCourierSchema.parse(base).trackingUrl).toBeNull();
    expect(setCourierSchema.parse({ ...base, trackingUrl: "" }).trackingUrl).toBeNull();
  });

  it("rejects a tracking URL that is not a real http(s) URL", () => {
    for (const trackingUrl of ["leopards.com/track", "javascript:alert(1)", "ftp://x.com/a", "not a url"]) {
      expect(setCourierSchema.safeParse({ ...base, trackingUrl }).success).toBe(false);
    }
  });

  it("rejects an implausible CN number", () => {
    expect(setCourierSchema.safeParse({ ...base, trackingNumber: "12345" }).success).toBe(false);
    expect(setCourierSchema.safeParse({ ...base, trackingNumber: "x".repeat(41) }).success).toBe(false);
    expect(setCourierSchema.safeParse({ ...base, trackingNumber: "LE 123 456" }).success).toBe(false);
  });

  it("rejects a missing courier name", () => {
    expect(setCourierSchema.safeParse({ ...base, courier: "L" }).success).toBe(false);
  });
});

describe("setOpsStatusSchema", () => {
  it("accepts a COD status and rejects anything else", () => {
    expect(setOpsStatusSchema.parse({ orderId: "o", status: "returned_to_sender" }).status)
      .toBe("returned_to_sender");
    expect(setOpsStatusSchema.safeParse({ orderId: "o", status: "refunded" }).success).toBe(false);
  });
});
