import type { ReactNode } from "react";

export type ChartCardProps = {
  title: string;
  description: string;
  /** Rendered instead of the chart when there is nothing to plot. */
  isEmpty?: boolean;
  emptyMessage?: string;
  /** Read out to screen readers and shown under the chart: the figures the picture encodes. */
  summary?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function ChartCard({
  title,
  description,
  isEmpty,
  emptyMessage = "No data in this window yet.",
  summary,
  action,
  children,
}: ChartCardProps) {
  return (
    <section className="chart-card">
      <header className="chart-card-head">
        <div>
          <h2>{title}</h2>
          <p className="admin-hint">{description}</p>
        </div>
        {action}
      </header>
      {isEmpty ? (
        <p className="admin-empty chart-card-empty">{emptyMessage}</p>
      ) : (
        <>
          <figure className="chart-card-figure">
            {children}
            {summary ? <figcaption className="chart-card-summary">{summary}</figcaption> : null}
          </figure>
        </>
      )}
    </section>
  );
}
