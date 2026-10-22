jest.mock("server-only", () => ({}));
jest.mock("next/headers", () => ({ headers: jest.fn() }));

import { headers } from "next/headers";
import { __resetRateLimits } from "@/server/rate-limit";

import { allowPublicAuthAttempt } from "./throttle";

describe("public auth throttle", () => {
  beforeEach(() => {
    __resetRateLimits();
    jest.mocked(headers).mockResolvedValue({ get: () => "192.0.2.10, 10.0.0.1" } as never);
  });

  it("normalizes email case to prevent account bucket bypass", async () => {
    for (let index = 0; index < 8; index++) {
      expect(await allowPublicAuthAttempt("sign-in", index % 2 ? "USER@example.com" : "user@example.com")).toBe(true);
    }
    expect(await allowPublicAuthAttempt("sign-in", "User@Example.com")).toBe(false);
  });

  it("caps reset requests for one account and keeps sign-in separate", async () => {
    for (let index = 0; index < 3; index++) {
      expect(await allowPublicAuthAttempt("password-reset", "user@example.com")).toBe(true);
    }
    expect(await allowPublicAuthAttempt("password-reset", "user@example.com")).toBe(false);
    expect(await allowPublicAuthAttempt("sign-in", "user@example.com")).toBe(true);
  });

  it("caps a caller that rotates email addresses", async () => {
    for (let index = 0; index < 30; index++) {
      expect(await allowPublicAuthAttempt("password-reset", `user${index}@example.com`)).toBe(true);
    }
    expect(await allowPublicAuthAttempt("password-reset", "next@example.com")).toBe(false);
  });
});
