import { NextResponse, type NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

/**
 * Generates a per-request CSP nonce so `script-src` can drop 'unsafe-inline'.
 *
 * NOT AN AUTHORIZATION BOUNDARY. Pass 2 deliberately rejected middleware as an
 * auth gate: it has no database connection, so it could only inspect a cookie,
 * and the principal contract forbids a role coming from anything the client can
 * shape. Authorization lives in the admin layout, server-side, reading the
 * membership row. Nothing may be added here that gates on identity.
 *
 * The policy is built here rather than in next.config.ts because the nonce is
 * per request. next.config keeps the four static headers; this owns the CSP.
 */
const isDev = process.env.NODE_ENV !== "production";

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = buildContentSecurityPolicy({ nonce, isDev });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // Only immutable build output under /_next/static is excluded: those are
  // content-hashed files served straight from disk, a CSP on a .js file governs
  // nothing, and running middleware on them would add a per-asset cost for no
  // security gain. /_next/image is NOT excluded - it is a dynamic handler whose
  // error responses are HTML, and excluding it silently dropped the CSP from
  // that class.
  matcher: [{ source: "/((?!_next/static).*)" }],
};
