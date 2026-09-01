export const dynamic = "force-dynamic"; // a static prerender carries no nonce, which would block every script under a nonce CSP

/**
 * The root 404 boundary: unmatched paths, and the `notFound()` the admin gate
 * throws (`(admin)/admin/layout.tsx`), which resolves here because no segment
 * between them declares one. Both surfaces therefore answer with the same
 * bytes, so a probe cannot tell an unrouted path from a gated admin tree.
 *
 * It renders in the ROOT layout, which has no storefront shell - reaching the
 * shell would mean awaiting `listPublishedProducts()`, putting a throwing
 * database call on the 404 path and forcing `/_not-found` dynamic. It stays
 * statically prerenderable: no cookies, no headers, no fetch.
 *
 * The storefront's own 404s do NOT land here. `(store)/products/not-found.tsx`
 * and `(store)/collections/not-found.tsx` are nearer boundaries and keep their
 * specific copy; see either file for why they sit one segment above the check.
 */
import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return <main className="route-state"><p className="section-label">404</p><h1>Page not found</h1><p>This page does not exist, or the link that brought you here is out of date.</p><Link className="primary-link" href="/">Return home</Link></main>;
}
