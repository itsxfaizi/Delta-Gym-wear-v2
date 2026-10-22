jest.mock("server-only", () => ({}));
jest.mock("@/server/auth/supabase", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/server/admin/guard", () => ({ requireAdminPrincipal: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));

import { AuthorizationError } from "@/server/authorization";
import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { requireAdminPrincipal } from "@/server/admin/guard";
import { createDatabase } from "@/server/db";

import { prepareProductImageUpload } from "./media-actions";

describe("prepareProductImageUpload", () => {
  const insertValues = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.mocked(createDatabase).mockReturnValue({
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    } as unknown as ReturnType<typeof createDatabase>);
  });

  it("does not mint an upload token for a publisher who cannot edit products", async () => {
    jest.mocked(requireAdminPrincipal).mockRejectedValue(new AuthorizationError());
    const log = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      const result = await prepareProductImageUpload({ fileName: "front.png", contentType: "image/png", size: 1_024 });
      expect(result).toEqual({ ok: false, message: "The image upload is unavailable. Please try again." });
      expect(requireAdminPrincipal).toHaveBeenCalledWith(["owner", "catalog_editor"]);
      expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    expect(createDatabase).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("uses a random tenant path instead of a submitted filename or path", async () => {
    const tenantId = "123e4567-e89b-42d3-a456-426614174001";
    jest.mocked(requireAdminPrincipal).mockResolvedValue({
      userId: "123e4567-e89b-42d3-a456-426614174000",
      tenantId,
      membership: { role: "owner", status: "active" },
    });
    const createSignedUploadUrl = jest.fn().mockImplementation(async (path: string) => ({ data: { path, token: "one-time-token" }, error: null }));
    const getPublicUrl = jest.fn().mockImplementation((path: string) => ({ data: { publicUrl: `https://images.example/${path}` } }));
    const storage = { createSignedUploadUrl, getPublicUrl };
    jest.mocked(createSupabaseServiceClient).mockReturnValue({
      storage: { from: jest.fn().mockReturnValue(storage) },
    } as unknown as ReturnType<typeof createSupabaseServiceClient>);

    const result = await prepareProductImageUpload({ fileName: "../../other-tenant/private.png", contentType: "image/png", size: 2_048 });
    const uploadedPath = createSignedUploadUrl.mock.calls[0][0];

    expect(result.ok).toBe(true);
    expect(uploadedPath).toMatch(new RegExp(`^${tenantId}/[0-9a-f-]+\\.png$`));
    expect(uploadedPath).not.toContain("other-tenant");
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      actorUserId: "123e4567-e89b-42d3-a456-426614174000",
      action: "product_image.upload_token_issued",
      targetType: "product_image",
      targetId: uploadedPath.split("/")[1].replace(".png", ""),
      requestId: expect.any(String),
      outcome: "success",
      before: null,
      after: { path: uploadedPath, contentType: "image/png", declaredSize: 2_048 },
    }));
    expect(JSON.stringify(insertValues.mock.calls)).not.toContain("one-time-token");
  });

  it("does not release an upload token when its audit record cannot be stored", async () => {
    jest.mocked(requireAdminPrincipal).mockResolvedValue({
      userId: "123e4567-e89b-42d3-a456-426614174000",
      tenantId: "123e4567-e89b-42d3-a456-426614174001",
      membership: { role: "owner", status: "active" },
    });
    const createSignedUploadUrl = jest.fn().mockResolvedValue({ data: { path: "123e4567-e89b-42d3-a456-426614174001/image.png", token: "secret-token" }, error: null });
    jest.mocked(createSupabaseServiceClient).mockReturnValue({
      storage: { from: jest.fn().mockReturnValue({ createSignedUploadUrl, getPublicUrl: jest.fn() }) },
    } as unknown as ReturnType<typeof createSupabaseServiceClient>);
    insertValues.mockRejectedValueOnce(new Error("audit unavailable"));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await prepareProductImageUpload({ fileName: "image.png", contentType: "image/png", size: 1_024 });
      expect(result).toEqual({ ok: false, message: "The image upload is unavailable. Please try again." });
      expect(result).not.toHaveProperty("token");
    } finally {
      log.mockRestore();
    }
  });

  it("rejects a signed response for a different object path", async () => {
    jest.mocked(requireAdminPrincipal).mockResolvedValue({
      userId: "123e4567-e89b-42d3-a456-426614174000",
      tenantId: "123e4567-e89b-42d3-a456-426614174001",
      membership: { role: "owner", status: "active" },
    });
    jest.mocked(createSupabaseServiceClient).mockReturnValue({
      storage: { from: jest.fn().mockReturnValue({
        createSignedUploadUrl: jest.fn().mockResolvedValue({ data: { path: "other-tenant/image.png", token: "secret-token" }, error: null }),
      }) },
    } as unknown as ReturnType<typeof createSupabaseServiceClient>);
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await prepareProductImageUpload({ fileName: "image.png", contentType: "image/png", size: 1_024 }))
        .toEqual({ ok: false, message: "The image upload is unavailable. Please try again." });
      expect(createDatabase).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
