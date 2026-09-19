import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/admin/product-form";
import { ProductStatusActions } from "@/components/admin/product-status-actions";
import { PRODUCT_PUBLISHER_ROLES } from "@/features/admin/schemas";
import { resolveAdminAccess } from "@/server/admin/guard";
import { getAdminProductForm } from "@/server/admin/queries";

import "../../../../../styles/admin-products.css";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, access] = await Promise.all([getAdminProductForm(id), resolveAdminAccess()]);
  if (!product) notFound();

  // Publishing is narrower than admin access, so the button only renders for a role
  // the action would actually accept.
  const canPublish =
    access.state === "granted" &&
    (PRODUCT_PUBLISHER_ROLES as readonly string[]).includes(access.principal.membership.role);

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>{product.title}</h1>
          <p className="admin-hint">
            {product.handle} · {product.status} · {product.variants.length} variants
          </p>
        </div>
        <div className="admin-actions">
          {canPublish ? <ProductStatusActions productId={id} status={product.status} /> : null}
          <Link className="admin-button" href={`/products/${product.handle}`}>
            View in store
          </Link>
        </div>
      </div>
      <div className="products-editor">
        <ProductForm product={product} />
      </div>
    </>
  );
}
