import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * The CSP is NOT built here. `src/middleware.ts` owns it, because the policy
 * carries a per-request nonce and a static config cannot produce one. This file
 * keeps the four headers that never vary, plus the HSTS rule. The pre-nonce
 * policy and the reasoning that replaced it are in `docs/security-headers.md`.
 */

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/**
 * HSTS is emitted only on a production build served over HTTPS, proven by the
 * proxy's `x-forwarded-proto`. A browser that pins HSTS for `localhost` breaks
 * every other local project on that machine and the server cannot undo it, so
 * the plaintext-localhost case must be impossible rather than unlikely: both
 * the build mode and the request scheme have to agree before the header is
 * sent. `preload` is intentionally absent - see the doc.
 */
const hstsRule = {
  source: "/(.*)",
  has: [{ type: "header" as const, key: "x-forwarded-proto", value: "https" }],
  headers: [
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
  ],
};

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      ...(isDev ? [] : [hstsRule]),
    ];
  },
};

export default nextConfig;
