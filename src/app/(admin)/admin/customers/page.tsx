import { CustomerTable } from "@/components/admin/customer-table";
import { KpiCard } from "@/components/admin/kpi-card";
import {
  RISK_RULE_TEXT,
  RISK_HIGH_RATIO,
  RISK_WATCH_RATIO,
  searchCustomers,
  type RiskLevel,
} from "@/features/admin/customers";
import { listCustomerRecords } from "@/server/admin/customers";

import "../../../../styles/admin-customers.css";

export const metadata = { title: "Customers — Delta admin" };

const PERCENT = new Intl.NumberFormat("en-PK", { style: "percent", maximumFractionDigits: 1 });

const RISK_FILTERS = ["ok", "watch", "high", "unknown"] as const;

const RISK_FILTER_LABELS: Record<(typeof RISK_FILTERS)[number], string> = {
  ok: "OK",
  watch: "Watch",
  high: "High",
  unknown: "Not enough history",
};

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
  const riskParam = first(params.risk);
  const risk = (RISK_FILTERS as readonly string[]).includes(riskParam) ? (riskParam as RiskLevel) : null;

  // The KPI strip describes every customer in the window, so it is derived
  // before the search/COD filters narrow the table.
  const { records: all, windowSize } = await listCustomerRecords();
  const records = searchCustomers(all, search).filter((record) => !risk || record.risk.level === risk);

  const repeat = all.filter((record) => record.orderCount > 1).length;
  const watch = all.filter((record) => record.risk.level === "watch").length;
  const high = all.filter((record) => record.risk.level === "high").length;

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Customers</h1>
          <p className="admin-hint">
            {all.length} {all.length === 1 ? "customer" : "customers"}, grouped from the last {windowSize} orders.
          </p>
        </div>
      </div>

      <div className="kpi-grid customer-kpis">
        <KpiCard label="Customers" value={String(all.length)} hint={`From the last ${windowSize} orders`} />
        <KpiCard
          label="Repeat rate"
          value={all.length ? PERCENT.format(repeat / all.length) : "—"}
          hint="Two or more orders in this window"
        />
        <KpiCard
          label="Watch list"
          value={String(watch)}
          hint={`${Math.round(RISK_WATCH_RATIO * 100)}% or more of settled orders failed`}
        />
        <KpiCard
          label="High risk"
          value={String(high)}
          hint={`${Math.round(RISK_HIGH_RATIO * 100)}% or more of settled orders failed`}
        />
      </div>

      <form className="admin-toolbar" action="/admin/customers" method="get">
        <div className="admin-field admin-field--wide">
          <label htmlFor="filter-q">Search name, email, phone or order number</label>
          <input id="filter-q" type="search" name="q" defaultValue={search} />
        </div>
        <div className="admin-field">
          <label htmlFor="filter-risk">COD signal</label>
          <select id="filter-risk" name="risk" defaultValue={risk ?? ""}>
            <option value="">Any</option>
            {RISK_FILTERS.map((level) => (
              <option key={level} value={level}>
                {RISK_FILTER_LABELS[level]}
              </option>
            ))}
          </select>
        </div>
        <button className="admin-button" type="submit">
          Search
        </button>
      </form>

      <aside className="customer-rule" aria-label="How the COD signal is inferred">
        {RISK_RULE_TEXT}
      </aside>

      {records.length === 0 ? (
        <p className="admin-empty">
          {search || risk
            ? "No customer matches that search."
            : "No customers yet — they appear here as soon as orders are placed."}
        </p>
      ) : (
        <CustomerTable records={records} />
      )}
    </>
  );
}
