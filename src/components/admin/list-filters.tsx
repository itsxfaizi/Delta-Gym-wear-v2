/** Plain GET form: filtering needs no client JavaScript. */
export function ListFilters({
  action,
  q,
  status,
  statuses,
  searchLabel,
}: {
  action: string;
  q: string;
  status: string | null;
  statuses: readonly string[];
  searchLabel: string;
}) {
  return (
    <form className="admin-filters" action={action} method="get">
      <div className="admin-field admin-field--wide">
        <label htmlFor="filter-q">{searchLabel}</label>
        <input id="filter-q" type="search" name="q" defaultValue={q} />
      </div>
      <div className="admin-field">
        <label htmlFor="filter-status">Status</label>
        <select id="filter-status" name="status" defaultValue={status ?? ""}>
          <option value="">All</option>
          {statuses.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <button className="admin-button" type="submit">
        Apply
      </button>
    </form>
  );
}
