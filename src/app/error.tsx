"use client";

/**
 * Root error boundary (contract E). `(store)/error.tsx` cannot catch a throw
 * from `(store)/layout.tsx` - that boundary renders inside the very layout it
 * would have to catch - and that layout awaits `listPublishedProducts()`, which
 * throws on any database failure and in the production runtime when the
 * development seed is the only catalog. This boundary sits above the route
 * groups and does catch it.
 *
 * Nothing from the error is rendered except `digest`, an opaque hash Next
 * generates for correlation. No message, no stack and no query text reaches the
 * browser, in development or in production.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="empty-state route-state"><h1>Something went wrong</h1><p>We couldn&rsquo;t load this page. Please try again.</p>{error.digest ? <p className="section-label">Reference {error.digest}</p> : null}<button className="primary-cta" onClick={reset}>Try again</button></main>;
}
