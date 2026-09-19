import { ProductForm } from "@/components/admin/product-form";

import "../../../../../styles/admin-products.css";

export default function NewProductPage() {
  return (
    <>
      <div className="admin-header">
        <div>
          <h1>New product</h1>
          <p className="admin-hint">A product needs at least one variant with a SKU and a price in paisa.</p>
        </div>
      </div>
      <div className="products-editor">
        <ProductForm />
      </div>
    </>
  );
}
