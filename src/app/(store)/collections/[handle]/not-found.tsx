import Link from "next/link";

export default function CollectionNotFound() {
  return <main className="route-state"><p className="section-label">404</p><h1>Collection not found</h1><p>This collection is not available in the published catalog.</p><Link className="primary-link" href="/shop">Browse all products</Link></main>;
}
