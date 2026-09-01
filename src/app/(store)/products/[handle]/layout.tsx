import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPublishedProduct } from "@/features/catalog/queries";

/**
 * The 404 has to resolve before the response is committed. `loading.tsx` opens
 * a Suspense boundary around `page.tsx`, and once that boundary streams the
 * status line has already been sent - the body said 404 while the wire said
 * 200. A segment's layout renders OUTSIDE its own loading boundary, so the
 * check here blocks the first flush and Next can still send a real 404, while
 * the skeleton keeps working for client-side navigation.
 *
 * `getPublishedProduct` is request-memoised, so this costs no extra query: the
 * page and `generateMetadata` read the same result.
 */
export default async function ProductLayout({ children, params }: Readonly<{ children: ReactNode; params: Promise<{ handle: string }> }>) {
  if (!(await getPublishedProduct((await params).handle))) notFound();
  return children;
}
