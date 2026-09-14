import {
  addressSchema,
  loginRedirectPath,
  safeNextPath,
  signUpSchema,
  signInSchema,
} from "./schemas";

describe("safeNextPath", () => {
  it("keeps a same-origin path", () => {
    expect(safeNextPath("/account/orders")).toBe("/account/orders");
  });

  it.each([
    null,
    undefined,
    "",
    "//evil.example.com",
    "https://evil.example.com",
    "/\\evil.example.com",
    "/account orders",
    "javascript:alert(1)",
  ])("rejects %p", (value) => {
    expect(safeNextPath(value)).toBe("/account");
  });
});

describe("loginRedirectPath", () => {
  it("encodes the target path", () => {
    expect(loginRedirectPath("/account/addresses")).toBe("/login?next=%2Faccount%2Faddresses");
  });

  it("omits the query when the target is the account home", () => {
    expect(loginRedirectPath("//evil.example.com")).toBe("/login");
  });
});

describe("signUpSchema", () => {
  const valid = {
    fullName: "Ayesha Khan",
    email: "ayesha@example.com",
    password: "correct-horse",
    confirmPassword: "correct-horse",
  };

  it("accepts a matching password pair", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it("reports mismatched passwords on the confirm field", () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("rejects a short password", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("rejects an invalid email", () => {
    expect(signInSchema.safeParse({ email: "nope", password: "password1" }).success).toBe(false);
  });
});

describe("addressSchema", () => {
  const valid = {
    fullName: "Ayesha Khan",
    phone: "+92 300 1234567",
    line1: "12 Gulberg Road",
    city: "Lahore",
    province: "Punjab",
  };

  it("applies defaults for the optional fields", () => {
    const result = addressSchema.parse(valid);
    expect(result).toMatchObject({ line2: null, postalCode: null, country: "PK", isDefault: false });
  });

  it("rejects a malformed phone number", () => {
    expect(addressSchema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
  });

  it("rejects a country that is not a 2-letter code", () => {
    expect(addressSchema.safeParse({ ...valid, country: "Pakistan" }).success).toBe(false);
  });
});

describe("addressSchema id", () => {
  const base = {
    fullName: "Ayesha Khan",
    phone: "+92 300 1234567",
    line1: "12 Gulberg Road",
    city: "Lahore",
    province: "Punjab",
  };

  it("treats an empty hidden id as a new address", () => {
    expect(addressSchema.parse({ ...base, id: "" }).id).toBeUndefined();
  });

  it("keeps a real uuid", () => {
    const id = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
    expect(addressSchema.parse({ ...base, id }).id).toBe(id);
  });

  it("rejects a non-uuid id", () => {
    expect(addressSchema.safeParse({ ...base, id: "nope" }).success).toBe(false);
  });
});
