/**
 * Lives here, not in `[handle]/`, because `ProductLayout` is what calls `notFound()` and
 * Next resolves that from an ANCESTOR segment - a boundary inside the segment the
 * layout renders would never catch it. Moving the check into the layout is what
 * makes the wire status a real 404; this keeps the approved copy with it.
 */
import Link from "next/link";
export default function NotFound() { return <main className="empty-state route-state"><h1>Product not found</h1><p>This product is not available in the published catalog.</p><Link className="primary-link" href="/shop">Return to shop</Link></main>; }
