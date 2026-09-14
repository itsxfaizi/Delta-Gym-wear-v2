import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/admin/product-form";
import { ProductStatusActions } from "@/components/admin/product-status-actions";
import { getAdminProductForm } from "@/server/admin/queries";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getAdminProductForm(id);
  if (!product) notFound();

  return (
    <>
      <div className="admin-header">
        <h1>{product.title}</h1>
        <div className="admin-actions">
          <ProductStatusActions productId={id} status={product.status} />
          <Link className="admin-button" href={`/products/${product.handle}`}>
            View in store
          </Link>
        </div>
      </div>
      <ProductForm product={product} />
    </>
  );
}
