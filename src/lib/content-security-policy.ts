/**
 * The single source for the Content-Security-Policy, kept pure and separate from
 * `src/middleware.ts` so both modes can be evaluated directly by a test instead
 * of being grepped out of source. The middleware supplies the per-request nonce.
 *
 * Every source here exists for a measured reason recorded in
 * `docs/security-headers.md`. Do not add one without adding its reason there.
 */
export function buildContentSecurityPolicy({ nonce, isDev }: { nonce: string; isDev: boolean }): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced bootstrap load Next's content-hashed
    // chunks, so no host allowlist is needed - and CSP3 browsers ignore 'self'
    // and 'unsafe-inline' entirely once a nonce is present. Those two remain
    // only as the CSP2 fallback for browsers that do not understand nonces; in
    // a modern browser the operative source is the nonce alone.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    // A nonce cannot authorise a style *attribute*, and the motion system writes
    // its CSS custom properties as inline style attributes on every frame.
    // Argued at length in docs/security-headers.md; this one is a real grant.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self'",
    `connect-src 'self'${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}
