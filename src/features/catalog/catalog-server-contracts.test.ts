import { createDatabase } from "@/server/db";
import { mediaReferences, productVariants, products } from "@/server/db/schema";
import { AuthorizationError, requireTenantRole, type AuthenticatedPrincipal } from "@/server/authorization";
import { listPublishedProducts, getPublishedProduct } from "./queries";

// Relative specifiers: jest.mock does not resolve the "@/" path alias, but both
// specifiers resolve to the same module the query layer imports.
jest.mock("../../server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("../../server/env", () => ({ getCatalogTenantId: () => "11111111-1111-4111-8111-111111111111" }));

/** Reads the column names out of the drizzle `asc()` fragments passed to `orderBy`. */
function orderedColumns(fragments: readonly unknown[]): string[] {
  return fragments
    .flatMap((fragment) => (fragment as { queryChunks?: readonly unknown[] }).queryChunks ?? [])
    .map((chunk) => (chunk as { name?: unknown }).name)
    .filter((name): name is string => typeof name === "string");
}

type RecordedSelect = { table: unknown; order: string[]; limit: number | null };

function createFakeDatabase(rowsByTable: ReadonlyMap<unknown, readonly unknown[]>) {
  const selects: RecordedSelect[] = [];

  const database = {
    select() {
      const recorded: RecordedSelect = { table: null, order: [], limit: null };
      const builder = {
        from(table: unknown) {
          recorded.table = table;
          return builder;
        },
        where() {
          return builder;
        },
        orderBy(...fragments: unknown[]) {
          recorded.order = orderedColumns(fragments);
          return builder;
        },
        limit(value: number) {
          recorded.limit = value;
          return builder;
        },
        then(
          onFulfilled: (rows: readonly unknown[]) => unknown,
          onRejected: (reason: unknown) => unknown,
        ) {
          selects.push(recorded);
          return Promise.resolve(rowsByTable.get(recorded.table) ?? []).then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
  };

  return { database, selects };
}

function productRow(id: string, handle: string) {
  return { id, handle, title: handle, description: null, status: "published" as const };
}

function variantRow(id: string, productId: string, sku: string, priceAmount: number) {
  return {
    id,
    productId,
    sku,
    size: "M",
    color: "Black",
    priceAmount,
    compareAtPriceAmount: null,
    currency: "PKR",
    isAvailable: true,
  };
}

function mediaRow(productId: string, objectKey: string) {
  return { productId, objectKey, altText: null };
}

const originalEnv = { DATABASE_URL: process.env.DATABASE_URL, LOG_LEVEL: process.env.LOG_LEVEL };

afterAll(() => {
  process.env.DATABASE_URL = originalEnv.DATABASE_URL;
  process.env.LOG_LEVEL = originalEnv.LOG_LEVEL;
});

describe("database-backed catalog reads", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://catalog.test/unused";
    // Keeps the structured read log out of the test output, and exercises the
    // logger's level filter at the same time.
    process.env.LOG_LEVEL = "error";
  });

  it("reads the whole catalog with one query per table instead of one per product", async () => {
    const { database, selects } = createFakeDatabase(
      new Map<unknown, readonly unknown[]>([
        [products, [productRow("p-1", "alpha"), productRow("p-2", "bravo"), productRow("p-3", "core")]],
        [
          productVariants,
          [
            variantRow("v-1", "p-1", "ALPHA-1", 4000),
            variantRow("v-2", "p-1", "ALPHA-2", 4500),
            variantRow("v-3", "p-2", "BRAVO-1", 6000),
          ],
        ],
        [mediaReferences, [mediaRow("p-1", "alpha/hero.png"), mediaRow("p-1", "alpha/detail.png")]],
      ]),
    );
    (createDatabase as jest.Mock).mockReturnValue(database);

    const catalog = await listPublishedProducts();

    // 1 products select + 1 variants select + 1 media select. The previous
    // implementation issued 1 + 3N selects for the same three products.
    expect(selects).toHaveLength(3);
    expect(selects.map((select) => select.table)).toEqual([products, productVariants, mediaReferences]);

    expect(catalog.map((product) => product.handle)).toEqual(["alpha", "bravo", "core"]);
    expect(catalog[0].variants.map((variant) => variant.sku)).toEqual(["ALPHA-1", "ALPHA-2"]);
    expect(catalog[0].images.map((image) => image.src)).toEqual(["alpha/hero.png", "alpha/detail.png"]);
    expect(catalog[1].variants.map((variant) => variant.sku)).toEqual(["BRAVO-1"]);
    // A product with no children still projects safely.
    expect(catalog[2]).toMatchObject({ variants: [], images: [], priceAmount: 0, currency: "PKR" });
  });

  it("orders products and their children deterministically", async () => {
    const { database, selects } = createFakeDatabase(
      new Map<unknown, readonly unknown[]>([[products, [productRow("p-1", "alpha")]]]),
    );
    (createDatabase as jest.Mock).mockReturnValue(database);

    await listPublishedProducts();

    expect(selects.map((select) => select.order)).toEqual([
      ["handle"],
      ["created_at", "sku"],
      ["created_at", "object_key"],
    ]);
  });

  it("derives price and hero image from the first ordered variant and media row", async () => {
    const { database, selects } = createFakeDatabase(
      new Map<unknown, readonly unknown[]>([
        [products, [productRow("p-1", "alpha")]],
        [productVariants, [variantRow("v-1", "p-1", "ALPHA-1", 4000), variantRow("v-2", "p-1", "ALPHA-2", 9900)]],
        [mediaReferences, [mediaRow("p-1", "alpha/hero.png"), mediaRow("p-1", "alpha/detail.png")]],
      ]),
    );
    (createDatabase as jest.Mock).mockReturnValue(database);

    const product = await getPublishedProduct("alpha");

    expect(product).toMatchObject({ priceAmount: 4000, currency: "PKR", source: "database" });
    expect(product?.images[0]?.src).toBe("alpha/hero.png");
    expect(selects[0]?.limit).toBe(1);
    expect(selects.map((select) => select.order.length > 0)).toEqual([false, true, true]);
  });

  it("rejects malformed handles before touching the database", async () => {
    const { database, selects } = createFakeDatabase(new Map());
    (createDatabase as jest.Mock).mockReturnValue(database);

    await expect(getPublishedProduct("../etc/passwd")).resolves.toBeNull();
    await expect(getPublishedProduct("  ")).resolves.toBeNull();
    expect(selects).toHaveLength(0);
  });
});

describe("tenant authorization", () => {
  const owner: AuthenticatedPrincipal = {
    userId: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    membership: { role: "owner", status: "active" },
  };

  it("allows an active principal holding an allowed role", () => {
    expect(requireTenantRole(owner, ["owner", "publisher"])).toBe(owner);
  });

  it("fails closed for a missing principal", () => {
    expect(() => requireTenantRole(null, ["owner"])).toThrow(AuthorizationError);
  });

  it("fails closed for an inactive membership even with the right role", () => {
    expect(() =>
      requireTenantRole({ ...owner, membership: { role: "owner", status: "suspended" } }, ["owner"]),
    ).toThrow(AuthorizationError);
  });

  it("fails closed for the wrong role", () => {
    expect(() =>
      requireTenantRole({ ...owner, membership: { role: "auditor", status: "active" } }, ["publisher"]),
    ).toThrow(AuthorizationError);
  });

  it("fails closed for an empty allow list and for an unknown role value", () => {
    expect(() => requireTenantRole(owner, [])).toThrow(AuthorizationError);
    expect(() =>
      requireTenantRole(
        { ...owner, membership: { role: "root" as AuthenticatedPrincipal["membership"]["role"], status: "active" } },
        ["owner"],
      ),
    ).toThrow(AuthorizationError);
  });
});
