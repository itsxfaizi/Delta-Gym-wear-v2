import { defineConfig, devices } from "@playwright/test";
import { assertSafeE2eTarget } from "./tests/db";

// AI failure-context snapshots include password input values. Keep them private.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

// Config is evaluated before Playwright starts its web server or any test.
// An existing server is never reused: its database target cannot be verified.
const target = assertSafeE2eTarget();
const baseURL = "http://127.0.0.1:3187";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  timeout: 90_000,
  // Every page is a round trip to Supabase in another region, so an occasional
  // slow response is latency, not a defect. One retry separates the two.
  retries: 1,
  // Auth flows carry passwords, session tokens, and TOTP codes. Keep traces off.
  use: { baseURL, trace: "off" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3187",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: target.databaseUrl,
      DELTA_TENANT_ID: target.tenantId,
      NEXT_PUBLIC_SUPABASE_URL: target.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: target.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: target.serviceRoleKey,
      APP_URL: baseURL,
      NEXT_PUBLIC_SITE_URL: baseURL,
      MAIL_PROVIDER: "console",
      DELTA_DEV_ADMIN: "",
      DELTA_INVITE_REDIRECT_READY: process.env.DELTA_INVITE_REDIRECT_READY ?? "",
      DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY: "",
      DELTA_INVITE_EMAIL_READY: "",
      CRON_SECRET: process.env.CRON_SECRET ?? "",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
