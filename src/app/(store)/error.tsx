"use client";
export default function StoreError({ reset }: { reset: () => void }) { return <main className="empty-state route-state"><h1>Something went wrong</h1><p>We couldn’t load the collection.</p><button className="primary-cta" onClick={reset}>Try again</button></main>; }
