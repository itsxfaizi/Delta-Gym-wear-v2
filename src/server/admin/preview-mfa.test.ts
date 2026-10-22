/** @jest-environment node */

jest.mock("server-only", () => ({}));

import { isMfaDisabledForIsolatedPreview } from "./preview-mfa";

const originalEnv = { ...process.env };

function setPreviewEnvironment(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    DELTA_PREVIEW_MFA_DISABLED: "true",
    DELTA_PREVIEW_MFA_DISABLED_SUPABASE_REF: "fppzcgcbfibyxcwsccbe",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "codex/feedback-expansion",
    VERCEL_URL: "delta-gym-wear-preview.vercel.app",
    NEXT_PUBLIC_SUPABASE_URL: "https://fppzcgcbfibyxcwsccbe.supabase.co",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("isolated preview MFA exception", () => {
  afterEach(() => {
    for (const key of [
      "DELTA_PREVIEW_MFA_DISABLED",
      "DELTA_PREVIEW_MFA_DISABLED_SUPABASE_REF",
      "VERCEL_ENV",
      "VERCEL_GIT_COMMIT_REF",
      "VERCEL_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("allows the exception only for the explicitly configured isolated branch preview", () => {
    setPreviewEnvironment();
    expect(isMfaDisabledForIsolatedPreview()).toBe(true);
  });

  const blockedEnvironments: Array<[string, Record<string, string | undefined>]> = [
    ["production environment", { VERCEL_ENV: "production" }],
    ["another branch", { VERCEL_GIT_COMMIT_REF: "main" }],
    ["missing explicit opt-out", { DELTA_PREVIEW_MFA_DISABLED: undefined }],
    ["wrong Supabase project", { NEXT_PUBLIC_SUPABASE_URL: "https://imyqylzsqsupanehdnhu.supabase.co" }],
    ["production project configured", { DELTA_PREVIEW_MFA_DISABLED_SUPABASE_REF: "imyqylzsqsupanehdnhu" }],
    ["non-Vercel host", { VERCEL_URL: "deltagymwear.com" }],
  ];

  it.each(blockedEnvironments)("keeps MFA enabled for %s", (_label, overrides) => {
    setPreviewEnvironment(overrides);
    expect(isMfaDisabledForIsolatedPreview()).toBe(false);
  });
});
