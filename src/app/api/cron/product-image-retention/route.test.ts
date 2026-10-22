/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("@/server/media/retention", () => ({ cleanupUnreferencedProductImages: jest.fn() }));

import { cleanupUnreferencedProductImages } from "@/server/media/retention";
import { GET } from "./route";

const secret = "a-long-random-test-secret";

describe("product image retention cron authorization", () => {
  const previousSecret = process.env.CRON_SECRET;
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });

  it("rejects calls when the secret is missing", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("https://example.com/api/cron/product-image-retention"));
    expect(response.status).toBe(401);
    expect(cleanupUnreferencedProductImages).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer token", async () => {
    process.env.CRON_SECRET = secret;
    const response = await GET(new Request("https://example.com/api/cron/product-image-retention", {
      headers: { authorization: "Bearer wrong-secret" },
    }));
    expect(response.status).toBe(401);
    expect(cleanupUnreferencedProductImages).not.toHaveBeenCalled();
  });

  it("runs dry mode with a valid bearer token", async () => {
    process.env.CRON_SECRET = secret;
    jest.mocked(cleanupUnreferencedProductImages).mockResolvedValue({ eligible: 1, deleted: 0, referenced: 0, failed: 0, dryRun: true });
    const response = await GET(new Request("https://example.com/api/cron/product-image-retention?dryRun=1", {
      headers: { authorization: `Bearer ${secret}` },
    }));
    expect(response.status).toBe(200);
    expect(cleanupUnreferencedProductImages).toHaveBeenCalledWith({ dryRun: true });
  });
});
