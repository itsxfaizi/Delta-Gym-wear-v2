import Link from "next/link";
import type { ReactNode } from "react";

const PERCENT = new Intl.NumberFormat("en-PK", { style: "percent", maximumFractionDigits: 1 });

export type KpiTrend = {
  /** Relative change against the prior period, or null when there is nothing to compare. */
  change: number | null;
  caption: string;
};

export type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: KpiTrend;
  href?: string;
  /** Colours the card's left edge. Omit for a plain card. */
  tone?: "accent" | "danger";
  /**
   * One number per day, oldest first, drawn as a bar strip. Where no real daily
   * series exists the strip's height is still reserved, so every card in the
   * row stands the same height.
   */
  series?: readonly number[];
};

/**
 * The delta line: arrow + percentage, then the caption. Always rendered, with an
 * em dash where there is nothing to compare, so no card loses a row of height.
 */
function Delta({ change, caption }: { change: number | null; caption?: string }): ReactNode {
  const direction = change === null ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat";
  return (
    <p className="kpi-trend" data-direction={direction}>
      <span aria-hidden>{direction === "up" ? "▲" : direction === "down" ? "▼" : "—"}</span>
      {change === null ? null : (
        <span>
          {change > 0 ? "+" : ""}
          {PERCENT.format(change)}
        </span>
      )}
      {caption ? <span className="kpi-trend-caption">{caption}</span> : null}
    </p>
  );
}

function Spark({ series }: { series?: readonly number[] }): ReactNode {
  const peak = Math.max(...(series ?? []), 0);
  return (
    <span className="kpi-spark" aria-hidden>
      {peak > 0
        ? series?.map((value, index) => (
            <span key={index} style={{ blockSize: `${Math.max(8, (value / peak) * 100)}%` }} />
          ))
        : null}
    </span>
  );
}

export function KpiCard({ label, value, hint, trend, href, tone, series }: KpiCardProps) {
  const body = (
    <>
      <span className="kpi-body">
        <span className="kpi-label">{label}</span>
        <strong className="kpi-value">{value}</strong>
        <Delta change={trend?.change ?? null} caption={trend?.caption ?? hint} />
      </span>
      <Spark series={series} />
    </>
  );

  if (href) {
    return (
      <Link className="kpi-card" data-tone={tone} href={href}>
        {body}
      </Link>
    );
  }

  return (
    <article className="kpi-card" data-tone={tone}>
      {body}
    </article>
  );
}
