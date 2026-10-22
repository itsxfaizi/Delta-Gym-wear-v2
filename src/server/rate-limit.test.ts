import { __resetRateLimits, consumeRateLimit } from "./rate-limit";

describe("consumeRateLimit", () => {
  beforeEach(__resetRateLimits);

  it("allows up to the limit then blocks", () => {
    const attempts = Array.from({ length: 4 }, () => consumeRateLimit("ip", 3, 1000, 0).allowed);
    expect(attempts).toEqual([true, true, true, false]);
  });

  it("reports how long the caller must wait", () => {
    for (let i = 0; i < 3; i += 1) consumeRateLimit("ip", 3, 1000, 0);
    expect(consumeRateLimit("ip", 3, 1000, 400).retryAfterMs).toBe(600);
  });

  it("starts a fresh window once the old one expires", () => {
    for (let i = 0; i < 3; i += 1) consumeRateLimit("ip", 3, 1000, 0);
    expect(consumeRateLimit("ip", 3, 1000, 1001).allowed).toBe(true);
  });

  it("counts each key separately", () => {
    for (let i = 0; i < 3; i += 1) consumeRateLimit("a", 3, 1000, 0);
    expect(consumeRateLimit("b", 3, 1000, 0).allowed).toBe(true);
  });

  it("cleans expired windows before the key cap rejects a new caller", () => {
    for (let index = 0; index < 10_000; index++) {
      expect(consumeRateLimit(`expired-${index}`, 1, 1000, 0).allowed).toBe(true);
    }
    expect(consumeRateLimit("new-caller", 1, 1000, 1001).allowed).toBe(true);
  });

  it("bounds live windows without resetting a blocked or existing caller", () => {
    for (let index = 0; index < 10_000; index++) {
      consumeRateLimit(`live-${index}`, 1, 1000, 0);
    }
    expect(consumeRateLimit("new-caller", 1, 1000, 1)).toEqual({ allowed: false, retryAfterMs: 999 });
    expect(consumeRateLimit("live-0", 1, 1000, 1).allowed).toBe(false);
    expect(consumeRateLimit("new-caller", 1, 1000, 1000).allowed).toBe(true);
  });
});
