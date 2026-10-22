jest.mock("server-only", () => ({}));
jest.mock("@/server/admin/guard", () => ({ requireAdminPrincipal: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));

import { createDatabase } from "@/server/db";
import { requireAdminPrincipal } from "./guard";
import { MissingProductImageAltTextError, setProductStatus } from "./mutations";

describe("setProductStatus", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  beforeEach(() => { process.env.DATABASE_URL = "postgres://not-used-by-mocked-database"; });
  afterEach(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  it("refuses to publish a draft whose saved image has no alt text", async () => {
    const tenantId = "123e4567-e89b-42d3-a456-426614174001";
    const productId = "123e4567-e89b-42d3-a456-426614174002";
    jest.mocked(requireAdminPrincipal).mockResolvedValue({
      tenantId,
      userId: "123e4567-e89b-42d3-a456-426614174003",
      membership: { role: "owner", status: "active" },
    });

    const currentProduct = { status: "draft" };
    const productQuery = { from: () => ({ where: () => ({ limit: () => ({ for: async () => [currentProduct] }) }) }) };
    const mediaQuery = { from: () => ({ where: async () => [{ altText: null }] }) };
    const tx = { select: jest.fn().mockReturnValueOnce(productQuery).mockReturnValueOnce(mediaQuery), update: jest.fn() };
    jest.mocked(createDatabase).mockReturnValue({
      transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx),
    } as unknown as ReturnType<typeof createDatabase>);

    await expect(setProductStatus(productId, "published")).rejects.toBeInstanceOf(MissingProductImageAltTextError);
    expect(tx.update).not.toHaveBeenCalled();
    expect(requireAdminPrincipal).toHaveBeenCalledWith(["owner", "publisher"]);
  });
});
