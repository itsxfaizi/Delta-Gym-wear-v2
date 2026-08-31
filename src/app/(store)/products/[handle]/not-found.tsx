import Link from "next/link";
export default function NotFound() { return <main className="empty-state route-state"><h1>Product not found</h1><p>This product is not available in the published catalog.</p><Link className="primary-link" href="/shop">Return to shop</Link></main>; }
