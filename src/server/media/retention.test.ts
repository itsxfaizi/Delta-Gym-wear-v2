jest.mock("server-only", () => ({}));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("@/server/env", () => ({ getCatalogTenantId: jest.fn(() => "123e4567-e89b-42d3-a456-426614174001") }));
jest.mock("@/server/auth/supabase", () => ({ createSupabaseServiceClient: jest.fn() }));

import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { createDatabase } from "@/server/db";
import { cleanupUnreferencedProductImages } from "./retention";

const tenantId = "123e4567-e89b-42d3-a456-426614174001";
const image = {
  tenantId,
  objectPath: `${tenantId}/123e4567-e89b-42d3-a456-426614174002.jpg`,
  publicUrl: "https://storage.example.com/storage/v1/object/public/product-images/photo.jpg",
  unreferencedAt: new Date("2026-09-01T00:00:00Z"),
  deletedAt: null,
};

function setup({ candidate = true, reference = false, removeError = null, imageRow = image }: {
  candidate?: boolean;
  reference?: boolean;
  removeError?: Error | null;
  imageRow?: typeof image;
} = {}) {
  const remove = jest.fn().mockResolvedValue({ error: removeError });
  jest.mocked(createSupabaseServiceClient).mockReturnValue({
    storage: { from: jest.fn().mockReturnValue({ remove }) },
  } as unknown as ReturnType<typeof createSupabaseServiceClient>);

  const auditValues = jest.fn().mockResolvedValue(undefined);
  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const tx = {
    select: jest.fn()
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => ({ for: async () => [imageRow] }) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: async () => reference ? [{ id: "reference" }] : [] }) }) }),
    update: jest.fn().mockReturnValue({ set: () => ({ where: updateWhere }) }),
    insert: jest.fn().mockReturnValue({ values: auditValues }),
  };
  const db = {
    select: jest.fn().mockReturnValue({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => candidate ? [{ objectPath: image.objectPath }] : [] }) }) }) }),
    transaction: jest.fn(async (work: (transaction: unknown) => Promise<unknown>) => work(tx)),
  };
  jest.mocked(createDatabase).mockReturnValue(db as unknown as ReturnType<typeof createDatabase>);
  return { remove, tx, db, auditValues, updateWhere };
}

describe("30-day product image cleanup", () => {
  it("does not call Storage for a dry run", async () => {
    const { remove, tx, updateWhere } = setup();
    const result = await cleanupUnreferencedProductImages({ dryRun: true, now: new Date("2026-10-21T00:00:00Z") });
    expect(result).toEqual({ eligible: 1, deleted: 0, referenced: 0, failed: 0, dryRun: true });
    expect(remove).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it("never deletes an image still referenced by a product", async () => {
    const { remove, updateWhere } = setup({ reference: true });
    const result = await cleanupUnreferencedProductImages({ now: new Date("2026-10-21T00:00:00Z") });
    expect(result.referenced).toBe(1);
    expect(remove).not.toHaveBeenCalled();
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it("deletes only the recorded path from the product-images bucket and audits it", async () => {
    const { remove, auditValues, updateWhere } = setup();
    const result = await cleanupUnreferencedProductImages({ now: new Date("2026-10-21T00:00:00Z") });
    expect(result.deleted).toBe(1);
    expect(remove).toHaveBeenCalledWith([image.objectPath]);
    expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: "attempted", tenantId, targetId: "123e4567-e89b-42d3-a456-426614174002" }));
    expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success", tenantId, targetId: "123e4567-e89b-42d3-a456-426614174002" }));
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it("retains the lifecycle row for retry when Storage removal fails", async () => {
    const { auditValues, updateWhere } = setup({ removeError: new Error("unavailable") });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await cleanupUnreferencedProductImages({ now: new Date("2026-10-21T00:00:00Z") });
    expect(result.failed).toBe(1);
    expect(updateWhere).not.toHaveBeenCalled();
    expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure" }));
    jest.restoreAllMocks();
  });

  it("does not touch Storage when no image has passed its retention window", async () => {
    const { remove, db } = setup({ candidate: false });
    const result = await cleanupUnreferencedProductImages({ now: new Date("2026-10-21T00:00:00Z") });
    expect(result.eligible).toBe(0);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("rechecks a candidate after locking and skips it if its timer was restarted", async () => {
    const { remove, tx } = setup({ imageRow: { ...image, unreferencedAt: new Date("2026-10-20T00:00:00Z") } });
    const result = await cleanupUnreferencedProductImages({ now: new Date("2026-10-21T00:00:00Z") });
    expect(result.deleted).toBe(0);
    expect(remove).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
