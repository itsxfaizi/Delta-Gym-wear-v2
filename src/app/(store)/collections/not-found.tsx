/**
 * Lives here, not in `[handle]/`, because `CollectionLayout` is what calls `notFound()` and
 * Next resolves that from an ANCESTOR segment - a boundary inside the segment the
 * layout renders would never catch it. Moving the check into the layout is what
 * makes the wire status a real 404; this keeps the approved copy with it.
 */
import Link from "next/link";

export default function CollectionNotFound() {
  return <main className="route-state"><p className="section-label">404</p><h1>Collection not found</h1><p>This collection is not available in the published catalog.</p><Link className="primary-link" href="/shop">Browse all products</Link></main>;
}
