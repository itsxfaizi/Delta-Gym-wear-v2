import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerDetail } from "@/components/admin/customer-detail";
import { getCustomerRecord } from "@/server/admin/customers";

import "../../../../../styles/admin-customers.css";
import "../../../../../styles/admin-ops.css";

export const metadata = { title: "Customer — Delta admin" };

export default async function AdminCustomerPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const record = await getCustomerRecord(decodeURIComponent(key));
  if (!record) notFound();

  return (
    <>
      <p className="admin-hint">
        <Link href="/admin/customers">Back to customers</Link>
      </p>
      <CustomerDetail record={record} />
    </>
  );
}
