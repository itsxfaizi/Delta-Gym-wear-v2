# Pass 3 contracts — security headers and route error handling

Authored by the orchestrator before any agent edited code, from measurements taken against the running application. Three agents implement against this in non-overlapping lanes.

## Two conflicts in the brief, resolved here

1. **"Security-header tests" was assigned to two agents.** The headers agent and the adversarial verifier cannot both own them. Resolution: **the adversarial verifier owns every file under `tests/`.** The headers agent verifies its own work with `curl` and throwaway scripts outside the repo, and ships no test file. This keeps the verifier genuinely independent — a header test written by the agent that wrote the header proves less.

2. **"CSP compatible with … Framer Motion."** There is no Framer Motion in this project and there never was; `package.json` has no `framer-motion`, `motion`, or `gsap`. The motion system is a `requestAnimationFrame` scroll scrub plus CSS custom properties, decided and documented in pass 1. **There is nothing to accommodate for it in CSP** — but the CSS-custom-property mechanism it uses does drive the single hardest CSP decision in this codebase, described under `style-src` below.

## Ownership — no file is owned by two agents

| Path | Owner |
| --- | --- |
| `next.config.ts`, `src/middleware.ts`, `docs/security-headers.md` | Headers |
| `src/app/**` — `not-found.tsx`, `error.tsx`, `global-error.tsx`, the two 404 gate layouts | Routing |
| `tests/**` | Verifier |
| everything else | **frozen this pass** |

Explicitly frozen: `db/**` and `src/server/db/schema.ts` (no schema or RLS changes this pass), `src/components/**` and `src/styles/**` (no homepage visuals or motion), `src/features/**`, `src/server/**`.

## Measured facts the CSP must satisfy

Taken from the running application, not assumed:

- **9 inline `style="…"` attributes** on a product page, and 4 source files use React `style={{…}}` to pass CSS custom properties (`--frame-opacity`, `--frame-translate`, `--crop-w`, `--crop-y`, `--timeline-progress`). A nonce **cannot** authorise a style *attribute* — nonces apply to `<style>` elements and `style-src-elem`, not to `style-src-attr` inline attributes. Removing them would mean rewriting frozen homepage files.
- **32 `<script>` tags** on a product page: Next's hydration and flight payload scripts, plus one `application/ld+json` block written with `dangerouslySetInnerHTML` in `src/app/(store)/products/[handle]/page.tsx`.
- **Zero external asset origins.** Fonts are self-hosted through `next/font/google` at build time, so no `fonts.googleapis.com` or `fonts.gstatic.com` is needed. The only absolute URLs in served HTML are `schema.org` and the canonical site URL, both as JSON-LD *text*, not fetched subresources.
- **A `<video>` element** (`/design-reference/assets/landing/hero-run.mp4`) and images including `data:` blur placeholders.
- `next dev` with Turbopack needs `'unsafe-eval'` and a WebSocket connection for HMR. Production must have neither.
- `/_not-found` is **statically prerendered** (`○` in the build output); every other route is dynamic (`ƒ`).

## Contract

### Headers

Keep, unchanged: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

Add a **Content-Security-Policy** and **Strict-Transport-Security**, subject to:

- **HSTS is production-HTTPS only.** It must never be sent on a plaintext localhost response — a browser that pins HSTS for `localhost` breaks every other local project on the machine, and that is not reversible from the server side.
- **No `'unsafe-eval'` in production.** Dev may have it; the two policies may differ and should be built from one source so they cannot drift.
- **No wildcard source** (`*`, `https:`, `data:` on `script-src`) without a written justification naming what breaks otherwise.
- `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'self'` are expected unless something concrete breaks.
- **`style-src 'unsafe-inline'` is accepted and must be justified in writing,** naming the inline-style-attribute mechanism above and what removing it would cost. Do not paper over it, and do not pretend a nonce solves it. If you find a way to drop it without touching frozen files, take it and say how.
- **A nonce, if used, must not be reused.** `/_not-found` is statically prerendered; a per-request nonce baked into cached HTML is worse than no nonce. Either force the affected route dynamic, or use a strategy that does not put a nonce in static output, and state which.
- Middleware is permitted **for nonce generation only**. Pass 2 deliberately rejected middleware as an authorization gate because it has no database connection and could only inspect a client-shapeable cookie. That decision stands: middleware added here must not perform, imply, or appear to perform authorization.
- **Local development must keep working**, including HMR, and static assets must keep loading. Verify, do not assume.
- Headers must be present on **HTML, API, 404, and error** responses — the 404 and error paths are the ones frameworks most often miss.

### Routing and error boundaries

- Unknown product and collection handles return **HTTP 404 on the wire** with the approved copy rendered. Both properties, together. Pass 2 fixed a regression where the status was right and the copy silently became Next's default: the existence check lives in the segment `layout.tsx` (which renders outside its own `loading.tsx` Suspense boundary, so the status is not yet committed), and the `not-found.tsx` boundary therefore had to move **up one segment** to `(store)/products/` and `(store)/collections/`, because a layout's `notFound()` resolves from an ancestor. **Preserve that placement.** Changing it silently reintroduces the regression, and the pre-existing test `storefront.spec.ts:"unknown collections and products use the not-found experience"` is what catches it.
- A server-render failure reaches the intended boundary. `src/app/error.tsx` exists and sits above `(store)/layout.tsx`, which makes the one call that throws in production. Assess whether `global-error.tsx` is also warranted now, and justify either answer.
- **No error response may disclose** an exception message, stack frame, absolute filesystem path, SQL fragment, database identifier, environment variable name, or whether a tenant or record exists.
- **Existing and missing resources must be non-disclosing in the same way** where the distinction is privileged. A public published product legitimately differs from a missing one; a *tenant-private* record must not.

## House rules

- No new runtime dependency without stating why a few lines will not do.
- Do not run `npm run build` or `npx playwright test`; the orchestrator runs those and a concurrent run clobbers shared state. `npm run typecheck`, `npm run lint`, `npm test` are fine.
- A dev server is running at **http://localhost:3001**. Port 3000 is an unrelated broken application returning HTTP 500 — ignore it, and do not edit `playwright.config.ts`, which points there.
- No secret, connection string, or key in source, tests, or documentation.
- Pass 1 and pass 2 contracts remain in force: the homepage data attributes, the progressive-enhancement deck, the principal/Result/audit contracts, and the migration integrity check.

---

# Pass 3 result — delivered and independently verified — 2026-09-01

## Verification, orchestrator-run

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 66 passed |
| `npm run db:check` | `db:check ok: 3 migrations, 7 files` |
| `npm run build` | exit 0 |
| `npx playwright test` | **81 passed** (was 61) |
| `npx playwright test --repeat-each=8` | **648 passed** |
| `npm run db:test:rls` | 44 passed |
| independent RLS verifier | 32 passed |
| Pass 1 acceptance harness | unchanged, fidelity delta 0.0000 |
| `py -m graphify update .` | **unavailable** — no `py`, no `graphify` module for `python3`, no `graphify-out/` |

## The CSP was hardened past what the headers agent shipped

The agent shipped `script-src 'self' 'unsafe-inline'` with a written argument and a three-step upgrade path, blocked on a routing-lane change. The blocker had been removed by the routing agent in the same pass, so the orchestrator executed the upgrade:

1. `src/app/not-found.tsx` gained `force-dynamic`. `/_next` build output confirms `/_not-found` is now `ƒ`, not `○` — a prerender carries no nonce, and under a nonce policy that blocks every script on every production 404.
2. `src/middleware.ts` generates a per-request nonce; `src/lib/content-security-policy.ts` holds the pure builder so both modes are executable in a test rather than grepped out of source.
3. The JSON-LD block carries the nonce. It is not executable, but `script-src` governs every `<script>` element, and leaving it unnonced would rely on the CSP2 token nonce-aware browsers ignore.

Shipped production policy, read off the wire from a real production server:

```
default-src 'self'; script-src 'nonce-<per-request>' 'strict-dynamic' 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self';
connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
```

In a CSP3 browser the nonce makes `'self'` and `'unsafe-inline'` inert, so `script-src` is real XSS protection rather than decoration. `style-src 'unsafe-inline'` remains and is unavoidable without rewriting frozen homepage components: the motion system writes CSS custom properties as inline style **attributes**, which fall under `style-src-attr`, and that directive takes only `'unsafe-inline'` or a hash of text that changes every frame.

## Production verification — real build, real Postgres

No agent could do this: they only had the dev server, whose policy carries `'unsafe-eval'` and `ws://`. The orchestrator provisioned a database from the repo's own migrations, seeded a published catalog, built, and served it.

- CSP present on `/`, `/shop`, a product page, `/collections/all`, `/api/health`, a store 404 and an unrouted 404 — **no `'unsafe-eval'`, no wildcard**.
- HSTS **absent** on plaintext localhost; **present** as `max-age=63072000; includeSubDomains` when `x-forwarded-proto: https` is supplied. Exactly the contract.
- Static chunks carry the four base headers and no CSP, which is correct — a CSP on a `.js` file governs nothing.
- The storefront **renders from the database**: the PDP shows its title, `/shop` lists the seeded product, the homepage serves five frames. Before this pass, `next start` had only ever returned 500, because the development seed is disabled in the production runtime — so the database-backed production path had never been exercised.
- Zero leakage in production error and 404 bodies. Development prints stack traces by design; production does not.

## Accepted gap: the malformed-encoding 400

`GET /products/%E0%A4%A` is answered by Next's legacy error renderer before `headers()` applies and before middleware runs, because the failure is in URL parsing. It returns framable HTML with **none of the five headers**. Not fixable from application code in Next 16.3.3; every other unusual pipeline was checked and does carry them. **Production requires an edge or proxy layer adding the five headers unconditionally.** The header sweep keeps this as a single named exception and additionally asserts the class is *still* broken, so the exception cannot silently rot once Next fixes it.

## Test corrections, and why they are not weakenings

Four verifier tests failed against the hardened policy. Three encoded assumptions that legitimately changed, one caught a real mistake:

- **`script-src` wildcard** — the test was right and the policy was wrong. `https:` was dropped; `'self'` is the CSP2 fallback instead.
- **Production CSP read from `next.config.ts`** — it moved to the middleware because it carries a per-request nonce. The test now evaluates the pure builder for both modes, and gained two assertions it could not make before: that production carries a nonce and `'strict-dynamic'`, and that `next.config.ts` does not emit a second, conflicting policy.
- **Relaxation naming** — the test treated the random `'nonce-…'` as an unjustified relaxation. A nonce is hardening, and a random value can never be "named" in a document.
- **Middleware identity scan** — it grepped raw source, and the middleware deliberately *discusses* authorization at length to record why it must never perform any. Comments are now stripped before scanning, so it tests code rather than prose.

One regression the orchestrator introduced and fixed: the first middleware matcher excluded `/_next/image`, silently dropping the CSP from the image-optimizer error class. The verifier's sweep caught it. The matcher now excludes only `/_next/static`.
