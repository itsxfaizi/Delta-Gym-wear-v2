import { buildOrderReceiptEmail } from "./receipt-email";
import type { Order } from "./types";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNumber: "DG-240131-0001",
    tenantId: "tenant-1",
    customerId: null,
    contactEmail: "shopper@example.com",
    contactPhone: "03001234567",
    shippingAddress: {
      fullName: "Ayesha Khan",
      phone: "03001234567",
      line1: "12 Gulberg Road",
      line2: null,
      city: "Lahore",
      province: "Punjab",
      postalCode: "54000",
      country: "PK",
    },
    status: "pending",
    paymentMethod: "cod",
    paymentStatus: "unpaid",
    subtotalAmount: 450_000,
    shippingAmount: 25_000,
    totalAmount: 475_000,
    currency: "PKR",
    notes: "Ring the bell twice",
    placedAt: new Date("2024-01-31T10:00:00Z"),
    items: [
      {
        id: "item-1",
        orderId: "order-1",
        productVariantId: "variant-1",
        productTitle: "Delta Performance Tee",
        variantLabel: "Black / M",
        sku: "DPT-BLK-M",
        unitPriceAmount: 450_000,
        quantity: 1,
        lineTotalAmount: 450_000,
      },
    ],
    ...overrides,
  };
}

describe("buildOrderReceiptEmail", () => {
  it("includes order number, line items, totals, address, and explicit COD wording", () => {
    const email = buildOrderReceiptEmail(makeOrder());

    expect(email.subject).toContain("DG-240131-0001");
    expect(email.text).toContain("DG-240131-0001");
    expect(email.text).toContain("Delta Performance Tee");
    expect(email.text).toContain("Black / M");
    expect(email.text).toContain("PKR 4,500");
    expect(email.text).toContain("PKR 250");
    expect(email.text).toContain("PKR 4,750");
    expect(email.text).toContain("Cash on delivery");
    expect(email.text).toContain("Ayesha Khan");
    expect(email.text).toContain("12 Gulberg Road");
    expect(email.html).toContain("Cash on delivery");
    expect(email.html).toContain("Delta Performance Tee");
  });

  it("omits the tracking link when none is given", () => {
    const email = buildOrderReceiptEmail(makeOrder());
    expect(email.text).not.toContain("Track your order");
    expect(email.html).not.toContain("Track your order");
  });

  it("includes a tracking link when one is provided", () => {
    const email = buildOrderReceiptEmail(makeOrder(), { trackingUrl: "https://delta.example/track/DG-240131-0001" });
    expect(email.text).toContain("https://delta.example/track/DG-240131-0001");
    expect(email.html).toContain("https://delta.example/track/DG-240131-0001");
  });

  it("never leaks internal notes into the customer email", () => {
    const email = buildOrderReceiptEmail(makeOrder({ notes: "SECRET: flagged for fraud review" }));
    expect(email.text).not.toContain("SECRET");
    expect(email.html).not.toContain("SECRET");
  });

  it("escapes HTML in address and item fields", () => {
    const email = buildOrderReceiptEmail(
      makeOrder({
        shippingAddress: {
          fullName: '<script>alert("x")</script>',
          phone: "03001234567",
          line1: "1 Road",
          line2: null,
          city: "Lahore",
          province: "Punjab",
          postalCode: null,
          country: "PK",
        },
      }),
    );
    expect(email.html).not.toContain("<script>");
  });
});
