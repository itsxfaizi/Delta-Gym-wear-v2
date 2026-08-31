import { getProductStatusTransition } from "./types";

describe("product status transitions", () => {
  it("allows the approved publish path", () => {
    expect(getProductStatusTransition("draft", "published")).toEqual({
      from: "draft",
      to: "published",
      requiredRole: "publisher",
    });
  });

  it("rejects direct publishing to archived", () => {
    expect(getProductStatusTransition("published", "archived")).toBeNull();
  });
});
