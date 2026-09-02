import { parseCheckoutFormData } from "./schema";

function checkoutForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  Object.entries({
    fullName: "Ali Khan",
    phone: "03001234567",
    email: "",
    addressLine1: "House 12, Street 4",
    addressLine2: "",
    city: "Lahore",
    province: "Punjab",
    postalCode: "",
    cartLines: JSON.stringify([{ productHandle: "ease-fit-trouser", variantId: "dev-ease-black-m", quantity: 1 }]),
    ...overrides,
  }).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("COD checkout schema", () => {
  it("accepts the approved guest COD fields", () => {
    const result = parseCheckoutFormData(checkoutForm());
    expect(result.success).toBe(true);
  });

  it("refuses a cart whose coalesced quantity passes the per-line cap", () => {
    // The reported attack: 100 lines x 99 units of one variant, which resolves to
    // 9,900 units and overflows the money columns at the seeded price.
    const duplicated = Array.from({ length: 100 }, () => ({ productHandle: "ease-fit-trouser", variantId: "dev-ease-black-m", quantity: 99 }));
    const result = parseCheckoutFormData(checkoutForm({ cartLines: JSON.stringify(duplicated) }));
    expect(result.success).toBe(false);
  });

  it("coalesces duplicate lines that stay inside the cap", () => {
    const duplicated = [
      { productHandle: "ease-fit-trouser", variantId: "dev-ease-black-m", quantity: 40 },
      { productHandle: "ease-fit-trouser", variantId: "dev-ease-black-m", quantity: 40 },
    ];
    const result = parseCheckoutFormData(checkoutForm({ cartLines: JSON.stringify(duplicated) }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cartLines).toEqual([{ productHandle: "ease-fit-trouser", variantId: "dev-ease-black-m", quantity: 80 }]);
    }
  });

  it("keeps distinct variants on their own lines", () => {
    const mixed = [
      { productHandle: "ease-fit-trouser", variantId: "dev-ease-black-m", quantity: 2 },
      { productHandle: "ease-fit-trouser", variantId: "dev-ease-sand-s", quantity: 3 },
      { productHandle: "ease-fit-trouser", variantId: "dev-ease-black-m", quantity: 4 },
    ];
    const result = parseCheckoutFormData(checkoutForm({ cartLines: JSON.stringify(mixed) }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cartLines).toEqual([
        { productHandle: "ease-fit-trouser", variantId: "dev-ease-black-m", quantity: 6 },
        { productHandle: "ease-fit-trouser", variantId: "dev-ease-sand-s", quantity: 3 },
      ]);
    }
  });

  it("rejects non-Pakistani mobile numbers and empty carts", () => {
    const result = parseCheckoutFormData(checkoutForm({ phone: "+923001234567", cartLines: "[]" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone).toEqual(["Enter a Pakistani mobile number like 03XXXXXXXXX."]);
      expect(result.error.flatten().fieldErrors.cartLines).toEqual(["Your cart is empty."]);
    }
  });
});
