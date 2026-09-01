import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPublishedCollection } from "@/features/catalog/queries";

/** Same reason as the product route: see `products/[handle]/layout.tsx`. */
export default async function CollectionLayout({ children, params }: Readonly<{ children: ReactNode; params: Promise<{ handle: string }> }>) {
  if (!(await getPublishedCollection((await params).handle))) notFound();
  return children;
}
