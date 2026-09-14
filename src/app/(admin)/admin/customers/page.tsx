import { CustomerTable } from "@/components/admin/customer-table";
import { RISK_RULE_TEXT } from "@/features/admin/customers";
import { listCustomerRecords } from "@/server/admin/customers";

import "../../../../styles/admin-customers.css";

export const metadata = { title: "Customers — Delta admin" };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = first(params.q).trim().slice(0, 80);
  const { records, windowSize } = await listCustomerRecords(search);

  return (
    <>
      <div className="admin-header">
        <h1>Customers</h1>
        <p className="admin-hint">
          {records.length} {records.length === 1 ? "customer" : "customers"}, grouped from the last {windowSize} orders.
        </p>
      </div>

      <form className="admin-filters" action="/admin/customers" method="get">
        <div className="admin-field admin-field--wide">
          <label htmlFor="filter-q">Search name, email, phone or order number</label>
          <input id="filter-q" type="search" name="q" defaultValue={search} />
        </div>
        <button className="admin-button" type="submit">
          Search
        </button>
      </form>

      <p className="admin-hint customer-rule">{RISK_RULE_TEXT}</p>

      {records.length === 0 ? (
        <p className="admin-empty">
          {search
            ? "No customer matches that search."
            : "No customers yet — they appear here as soon as orders are placed."}
        </p>
      ) : (
        <CustomerTable records={records} />
      )}
    </>
  );
}
