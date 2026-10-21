import { inviteMemberSchema, isLastActiveOwner, setStatusSchema, type Membership } from "./team";

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

  it("does not count an invited owner as active", () => {
    const pendingOwner = { authUserId: "owner-3", role: "owner", status: "invited" } as Membership;
    expect(isLastActiveOwner([...members, pendingOwner], "owner-1")).toBe(true);
  });
});

describe("staff invitation input", () => {
  it("normalizes an email and accepts only known roles", () => {
    expect(inviteMemberSchema.parse({ email: "  STAFF@Example.com  ", role: "auditor" })).toEqual({
      email: "staff@example.com",
      role: "auditor",
    });
    expect(inviteMemberSchema.safeParse({ email: "staff@example.com", role: "superadmin" }).success).toBe(false);
    expect(inviteMemberSchema.safeParse({ email: "not an email", role: "auditor" }).success).toBe(false);
  });

  it("does not allow an owner to activate an invitation through the status action", () => {
    expect(setStatusSchema.safeParse({
      authUserId: "123e4567-e89b-42d3-a456-426614174000",
      status: "invited",
    }).success).toBe(false);
  });
});
