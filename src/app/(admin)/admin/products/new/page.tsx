import { ProductForm } from "@/components/admin/product-form";

export default function NewProductPage() {
  return (
    <>
      <div className="admin-header">
        <h1>New product</h1>
      </div>
      <ProductForm />
    </>
  );
}
