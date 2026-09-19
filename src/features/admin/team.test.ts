import { isLastActiveOwner, type Membership } from "./team";

const members: Membership[] = [
  { authUserId: "owner-1", role: "owner", status: "active" },
  { authUserId: "owner-2", role: "owner", status: "suspended" },
  { authUserId: "editor-1", role: "catalog_editor", status: "active" },
];

describe("isLastActiveOwner", () => {
  it("is true for the sole active owner", () => {
    expect(isLastActiveOwner(members, "owner-1")).toBe(true);
  });

  it("is false for a suspended owner, even if no other owner is active", () => {
    expect(isLastActiveOwner(members, "owner-2")).toBe(false);
  });

  it("is false for a non-owner", () => {
    expect(isLastActiveOwner(members, "editor-1")).toBe(false);
  });

  it("is false once a second active owner exists", () => {
    const withTwoOwners = [...members, { authUserId: "owner-3", role: "owner", status: "active" } as Membership];
    expect(isLastActiveOwner(withTwoOwners, "owner-1")).toBe(false);
  });

  it("is false for an id that is not a member", () => {
    expect(isLastActiveOwner(members, "nobody")).toBe(false);
  });
});
