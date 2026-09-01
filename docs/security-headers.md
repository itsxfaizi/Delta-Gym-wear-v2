# Security headers

Everything is in `next.config.ts`. There is no `src/middleware.ts` and adding one
is not needed — see [Middleware](#middleware-not-added).

## The header set

| Header | Value | Scope |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | all responses (pre-existing, unchanged) |
| `X-Frame-Options` | `DENY` | all responses (pre-existing, unchanged) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | all responses (pre-existing, unchanged) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | all responses (pre-existing, unchanged) |
| `Content-Security-Policy` | see below | all responses |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | production build **and** `x-forwarded-proto: https` only |

One array builds the CSP for both modes, so the development and production
policies cannot drift: the only differences are two conditional appends driven
by `process.env.NODE_ENV`.

## The policy, directive by directive

```
default-src 'self';
script-src 'self' 'unsafe-inline' ['unsafe-eval' in development];
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
media-src 'self';
connect-src 'self' [ws://localhost:* ws://127.0.0.1:* in development];
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
form-action 'self'
```

| Directive | Why | What breaks without it |
| --- | --- | --- |
| `default-src 'self'` | Backstop for every directive not named. The application has **zero external asset origins**: `next/font/google` self-hosts both faces at build time, and the only absolute URLs in served HTML are `schema.org` and the canonical site URL as JSON-LD *text*, never fetched. | Nothing loads. |
| `script-src 'self'` | All chunks are served from the app's own origin. | Every `/_next/static/chunks/*.js` is blocked; the app does not boot. |
| `script-src 'unsafe-inline'` | Next streams the RSC flight payload as inline `<script>self.__next_f.push(…)</script>` elements — 23 to 38 of them per page as measured — plus the product page's `application/ld+json` block written with `dangerouslySetInnerHTML`. | Hydration dies: the shell renders, the flight payload never arrives, client navigation and every interactive control stop working. See [No nonce](#no-nonce-and-why-not) for why the usual fix is not available here. |
| `script-src 'unsafe-eval'` **(development only)** | Turbopack's HMR runtime evaluates modules. | HMR breaks. Absent from the production policy — verified by evaluating `headers()` with `NODE_ENV=production`. |
| `style-src 'self'` | The compiled stylesheet is same-origin. | Unstyled page. |
| `style-src 'unsafe-inline'` | See [The style-attribute problem](#the-style-attribute-problem). | The motion system stops moving. |
| `img-src 'self' data:` | `data:` covers `next/image` blur placeholders. No remote image origin is configured in `next.config.ts`, so no host source is required. `data:` on `img-src` is not the dangerous case the contract warns about — that warning is about `data:` on `script-src`, which we do not have. | Blur-up placeholders are blocked and images pop in. |
| `font-src 'self'` | The two `next/font/google` faces are self-hosted `/_next/static/media/*.woff2`. | Fallback system fonts; the design breaks. |
| `media-src 'self'` | `/design-reference/assets/landing/hero-run.mp4`. | The hero video never plays. |
| `connect-src 'self'` | Supabase is used **server-side only** (`src/server/auth/*`); no browser client exists, so production talks to nothing but its own origin. | RSC fetches and server-action posts are blocked. |
| `connect-src ws://localhost:* ws://127.0.0.1:*` **(development only)** | The Turbopack HMR websocket (`ws://localhost:3001/_next/hmr?id=…`). CSP Level 3 says `'self'` should match `ws:` for an `http:` origin, but that has not been uniformly implemented, so it is named explicitly rather than assumed. | HMR silently stops reconnecting. Absent from the production policy. |
| `object-src 'none'` | No `<object>`/`<embed>`; closes a legacy plugin-based script-execution vector. | — |
| `base-uri 'none'` | Stops an injected `<base>` tag from repointing every relative script URL — the standard escape hatch out of a host-based `script-src`. | — |
| `frame-ancestors 'none'` | Clickjacking. Duplicates `X-Frame-Options: DENY` deliberately: `frame-ancestors` is the modern one, `X-Frame-Options` covers old agents. | — |
| `form-action 'self'` | Stops an injected form from posting the cart or session anywhere else. | — |

No wildcard source (`*`, `https:`, `data:` on `script-src`) is used anywhere.

## The style-attribute problem

**`style-src 'unsafe-inline'` is a real weakening of this policy and it is here on
purpose.**

The mechanism: the motion system is a `requestAnimationFrame` scroll scrub that
writes CSS custom properties — `--frame-opacity`, `--frame-translate`,
`--crop-w`, `--crop-y`, `--timeline-progress` — through React `style={{…}}` in
four source files, which the browser receives as inline `style="…"`
**attributes**. 35 to 37 elements carry one on the homepage after a scroll.

A nonce cannot authorise a style *attribute*. Nonces bind to `<style>`
*elements* (`style-src-elem`); attributes are governed by `style-src-attr`,
which accepts only `'unsafe-inline'` or a hash of the attribute's exact text.
The attribute text here changes on every animation frame, so hashes are
impossible by construction. This is a property of CSP, not of our
implementation, and no amount of nonce plumbing changes it.

Removing it would mean rewriting `src/components/storefront/*` to drive the
custom properties from a stylesheet rather than from the element — a rewrite of
the frozen homepage motion files, which pass 3 explicitly does not permit, and
which would re-open the pass-1 motion contract.

What it costs, stated plainly: an attacker who achieves HTML injection can
apply arbitrary CSS through a `style` attribute. That is real — CSS can be used
for UI redress, content obscuring, and (with an attribute selector plus a
`url()` in an already-allowed source) limited data probing. It is a materially
smaller blast radius than script execution, and it is the half of the policy we
were forced to give up, not the half we chose to.

**What would remove it**: replacing the inline custom-property writes with a
single same-origin `<style>` element updated by the rAF loop (`style.sheet`
mutation is not governed by `style-src` at all), or with `CSS.registerProperty`
plus class toggles. Both are frozen-file work and neither is a header change.

## No nonce, and why not

**Decision: no nonce anywhere. There is no per-request nonce in this
application, so nothing can leak one into cached HTML.**

`/_not-found` is statically prerendered (`○` in the build output); every other
route is dynamic (`ƒ`). The failure mode a nonce would produce here is worse
than the contract's framing of it. Reading `next/dist/server/app-render/app-render.js`:

- Next takes the nonce from the **request's** `Content-Security-Policy` header
  (`parsedRequestHeaders.nonce`, via `getScriptNonceFromHeader`), i.e. from
  whatever middleware set on the way in.
- Prerendering happens at build time, where there is no such request header, so
  the prerendered HTML's script tags carry **no nonce at all**.
- `dist/server/base-server.js` contains no occurrence of `nonce`: the presence
  of a nonce does **not** bypass the static response cache.

So a middleware-generated nonce would not be *reused* in the static 404 — it
would be *absent* from it while the response header demanded it. Every 404 in
production would serve HTML whose inline flight scripts are blocked, and with
`'strict-dynamic'` (which makes `'self'` ignored) the chunks would be blocked
too and the 404 page would be inert. A broken 404 page on every unknown URL is
not an acceptable trade for a stronger `script-src`.

The contract's other option — force the affected route dynamic — is not
available to this lane: `/_not-found` is produced from `src/app/**`, which the
routing agent owns this pass. Making the whole application dynamic to satisfy a
header is also the tail wagging the dog.

**Upgrade path, in order.** Do all three or none:

1. Add a root `src/app/not-found.tsx` with `export const dynamic = "force-dynamic"`
   and confirm `/_not-found` shows `ƒ`, not `○`, in `next build` output.
2. Add `src/middleware.ts` that generates a per-request nonce, sets it on both
   the request and response `Content-Security-Policy`, and matches everything
   except `/_next/static`, `/_next/image` and prefetches.
3. Change `script-src` to `'self' 'nonce-…' 'strict-dynamic'` and delete
   `'unsafe-inline'` from it. `style-src 'unsafe-inline'` stays regardless — see
   above.

Until step 1 exists, adding steps 2 and 3 ships a broken 404 page that no
development-mode test can catch, because `next dev` prerenders nothing.

## Middleware: not added

None. The nonce was the only permitted reason to add it, and there is no nonce.

If middleware is ever added for step 2 above, it must generate a nonce and
nothing else. **Middleware is not an authorization boundary in this codebase
and must never be made to look like one.** Pass 2 rejected that explicitly:
middleware has no database connection, so the only thing it could inspect is a
client-shapeable cookie, which is precisely what the principal contract
forbids. Authorization stays where the database is.

## HSTS

```ts
{
  source: "/(.*)",
  has: [{ type: "header", key: "x-forwarded-proto", value: "https" }],
  headers: [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }],
}
```

Two independent conditions must both hold before the header exists:

1. **`NODE_ENV === "production"`** — in development the rule is not in the
   `headers()` array at all, so no request can produce it.
2. **`x-forwarded-proto: https`** on the request — the terminating proxy's
   assertion that the connection was TLS. A plaintext request does not carry
   it.

This is deliberately belt-and-braces. A browser that pins HSTS for `localhost`
breaks every other local project on that machine and the server cannot revoke
it, so the plaintext-localhost case has to be *impossible*, not merely
*unlikely* — `next start` on `http://localhost` is production mode over
plaintext, and condition 2 is what stops it.

`preload` is intentionally omitted. `includeSubDomains` + `preload` submitted to
`hstspreload.org` is effectively irreversible and would harden every subdomain
of `deltagymwear.com`, including any that does not serve HTTPS yet. Add the
token, and submit, only once every subdomain is confirmed HTTPS-only.

## Enforcing, not Report-Only

The policy ships **enforcing** from the start. Report-Only is the right tool
when you are about to break something you cannot fully enumerate; that is not
the situation here. The origin has no third-party scripts, no external asset
origins, no analytics and no embeds, so the set of things the policy can break
is exactly the set that was walked in a real browser (below) and found clean —
zero violations across six routes including both 404 paths, with hydration,
client-side navigation, fonts, hero video and the scroll motion all working.

A Report-Only phase would be justified if any of these changed: a third-party
script or pixel is added, an external asset origin appears, or the nonce
upgrade above is attempted. In that case ship the stricter policy as
`Content-Security-Policy-Report-Only` alongside the enforcing one, with
`report-to`, and flip it once a full release cycle of real traffic produces no
violation reports from the strict policy. Shipping Report-Only *now* would mean
shipping no protection at all while implying otherwise.

## Verification

Against the development server at `http://localhost:3001`.

**On the wire — all five headers present on every pipeline:**

| Response | Status | Pipeline |
| --- | --- | --- |
| `/` | 200 | app render, HTML |
| `/api/health` | 200 | route handler, JSON |
| `/design-reference/assets/delta-logo.svg` | 200 | static file |
| `/no-such-page` | 404 | app router not-found |
| `/products/nope` | 404 | segment `notFound()` |
| `/_next/static/chunks/nonexistent.js` | 404 | static pipeline |
| `PATCH /api/health` | 405 | route handler method reject |
| `POST /` with bogus `Next-Action` | 404 | server-action resolution |
| `/` with a seed asset temporarily removed | **500** | `error.tsx` boundary |

The 500 was produced by momentarily renaming one file under
`public/design-reference/`, which makes `validateDevelopmentSeedAssets()` throw
during the `(store)/layout.tsx` render, and restoring it in the same command.
The mechanism is visible in `next/dist/server/lib/router-utils/resolve-routes.js`:
`headers()` rules are collected into `resHeaders` during **route resolution**,
before the renderer runs, so the response carries them whatever status the
render ends up producing.

**In a real browser** (headless Chromium, `page.on("console")` collecting
`Refused to …` / CSP messages) over `/`, `/shop`,
`/products/ease-fit-trouser`, `/cart`, `/no-such-page`, `/products/nope`:

- **0 CSP violations, 0 page errors, 0 failed requests.**
- Hydration confirmed (`__reactFiber$…` on the mounted root; `window.__next_f`
  populated) and client-side navigation `/` → `/shop` works.
- `document.fonts.status === "loaded"`, 13 faces.
- Hero video `readyState 4`, `paused: false`, playing from `media-src 'self'`.
- 35 inline `style` attributes after a scroll, i.e. the rAF motion system is
  still writing custom properties.
- HMR websocket connected: `ws://localhost:3001/_next/hmr?id=…`.
- No `Strict-Transport-Security` on any localhost response, including one sent
  with a spoofed `X-Forwarded-Proto: https`.

**Production-only behaviour, verified by evaluating the config rather than on
the wire.** `next.config.ts`'s `headers()` was imported and called with
`NODE_ENV=production` and with `NODE_ENV=development`. Production emits
`script-src 'self' 'unsafe-inline'` (no `'unsafe-eval'`), `connect-src 'self'`
(no websocket), and the HSTS rule gated on `x-forwarded-proto`. Development
emits the two dev sources and **no HSTS rule of any kind**.

### Not verified, and what would verify it

A production build was out of scope for this lane (the orchestrator runs
`next build`). Unverified on the wire:

1. **The production policy against real production HTML.** Production omits the
   Turbopack HMR machinery, so it should be a strict subset of what was walked
   here, but it has not been observed. Run the browser walk again against
   `next build && next start`.
2. **HSTS actually appearing on an HTTPS response.** The `has` condition matches
   `x-forwarded-proto: https` exactly; a proxy that sends a comma-joined chain
   (`https,http`) will not match, and the header will be silently absent —
   fail-safe, but check it on the real proxy after the first deploy.
3. **The static `/_not-found` under the production policy.** It should be fine
   precisely because there is no nonce, but it is the route this document
   argues about most and it does not exist in `next dev`.

---

## Orchestrator amendment — the nonce was adopted after all — 2026-09-01

The sections above argue for a no-nonce policy with `script-src 'self' 'unsafe-inline'`. That reasoning was sound given what it could observe, and its own three-step upgrade path is what was executed. The upgrade landed, so **the sections above no longer describe the shipped policy** for `script-src`; everything they say about `style-src`, HSTS, Report-Only and the four static headers still stands.

### What changed

1. `src/app/not-found.tsx` gained `export const dynamic = "force-dynamic"`. This was the blocker: `/_not-found` was statically prerendered, and a prerender carries no nonce, so a nonce policy would have blocked every script on every production 404. The route is now rendered per request, which costs one render on a path nobody should reach and removes the failure mode entirely.
2. `src/middleware.ts` generates a per-request nonce and owns the CSP. `next.config.ts` keeps the four static headers and the HSTS rule; the CSP constant there is retained, renamed and unused, as the record of the pre-nonce policy.
3. The JSON-LD block in `src/app/(store)/products/[handle]/page.tsx` carries the request nonce. It is not executable, but `script-src` governs every `<script>` element, and leaving it unnonced would have meant relying on the CSP2 `'unsafe-inline'` token that nonce-aware browsers deliberately ignore.

### The shipped script-src

```
script-src 'nonce-<per-request>' 'strict-dynamic' 'unsafe-inline' https:
```

This is the standard strict-CSP shape. In a CSP3 browser the nonce is present, so `'unsafe-inline'` and `https:` are **ignored**, and `'strict-dynamic'` lets the nonced bootstrap load Next's hashed chunks without a host allowlist. In a CSP2-only browser the nonce is ignored and the policy degrades to the previous behaviour rather than breaking the site. The relaxations are therefore compatibility fallbacks, not live grants — which is a materially different security posture from the un-nonced policy, where `'unsafe-inline'` was the operative token and `script-src` provided essentially no XSS protection.

### `style-src 'unsafe-inline'` is unchanged and still required

Nothing here fixes it, and the original argument stands in full: the motion system writes `--frame-opacity`, `--frame-translate`, `--crop-w`, `--crop-y` and `--timeline-progress` as inline **style attributes**, which fall under `style-src-attr`. That directive accepts only `'unsafe-inline'` or a hash of the exact text, and the text changes every animation frame, so hashes are impossible by construction. Removing it means rewriting frozen homepage components. The residual risk is unchanged: HTML injection buys arbitrary CSS — UI redress, content obscuring, limited attribute-selector probing — but not script execution.

### Verified after the change

Six routes in a real browser (`/`, `/shop`, a product page, `/cart`, a store 404, an unrouted path): **0 CSP violations, 0 console errors, 0 page errors**. Hydration completed, `Outfit` applied, every image decoded, the hero video reached `readyState 4`, inline style attributes parsed non-empty, and the JSON-LD parsed with `nonce` present. The nonce differs on consecutive requests, and Next stamps it onto all 35 inline scripts.

### Middleware is still not an authorization boundary

It generates a nonce. That is all it does, and the file says so. Pass 2 rejected middleware as an auth gate because it has no database connection and could only inspect a client-shapeable cookie; authorization remains in the admin layout, server-side, reading the membership row. Nothing that gates on identity may be added here.

## Accepted gap: the malformed-encoding 400 carries no headers

`GET /products/%E0%A4%A` — invalid percent-encoding — is answered by Next's legacy error renderer **before** `next.config.ts` `headers()` applies, and before middleware runs, because the failure happens during URL parsing. The response is `400 Bad Request` with framable HTML and **none of the five headers**, including no `nosniff` and no `X-Frame-Options`.

This is not fixable from application code in Next 16.3.3: both header mechanisms run after the URL has parsed. Every other unusual pipeline was checked and **does** carry all five — image-optimizer 400, static-file 416, RSC 307, API 405, static-asset 404, fonts, video, JS and CSS chunks.

**Production requirement, not optional:** the edge or reverse proxy in front of this application must add the five headers unconditionally, so that responses the framework generates before routing are covered. Without that layer this gap is live in production.
