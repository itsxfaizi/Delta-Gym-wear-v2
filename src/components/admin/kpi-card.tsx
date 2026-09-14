import { Minus, TrendingDown, TrendingUp } from "lucide-react";
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
  /** Set when the number is a problem to act on rather than a result to enjoy. */
  alert?: boolean;
};

function Trend({ change, caption }: KpiTrend): ReactNode {
  if (change === null) return null;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  return (
    <p className="kpi-trend" data-direction={direction}>
      <Icon aria-hidden size={14} strokeWidth={2.25} />
      <span>
        {change > 0 ? "+" : ""}
        {PERCENT.format(change)}
      </span>
      <span className="kpi-trend-caption">{caption}</span>
    </p>
  );
}

export function KpiCard({ label, value, hint, trend, href, alert }: KpiCardProps) {
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {trend ? <Trend {...trend} /> : null}
      {hint ? <span className="kpi-hint">{hint}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link className="kpi-card" data-alert={alert ? "" : undefined} href={href}>
        {body}
      </Link>
    );
  }

  return (
    <article className="kpi-card" data-alert={alert ? "" : undefined}>
      {body}
    </article>
  );
}
