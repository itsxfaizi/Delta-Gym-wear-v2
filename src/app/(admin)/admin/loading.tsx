import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the dashboard's grid exactly so nothing shifts when the data lands. */
export default function AdminDashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="admin-loading">
      <div className="admin-header">
        <div>
          <Skeleton className="skeleton-title" />
          <Skeleton className="skeleton-line" />
        </div>
      </div>

      <div className="kpi-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="kpi-card" key={index}>
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-number" />
          </div>
        ))}
      </div>

      <div className="admin-charts">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="chart-card" key={index}>
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-chart" />
          </div>
        ))}
      </div>

      <div className="admin-columns">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="admin-panel" key={index}>
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-block" />
          </div>
        ))}
      </div>
    </div>
  );
}
