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

  it("rejects non-Pakistani mobile numbers and empty carts", () => {
    const result = parseCheckoutFormData(checkoutForm({ phone: "+923001234567", cartLines: "[]" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone).toEqual(["Enter a Pakistani mobile number like 03XXXXXXXXX."]);
      expect(result.error.flatten().fieldErrors.cartLines).toEqual(["Your cart is empty."]);
    }
  });
});
