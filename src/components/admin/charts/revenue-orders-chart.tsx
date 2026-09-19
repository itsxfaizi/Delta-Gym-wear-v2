import { CHART_COLORS } from "./palette";

export type RevenuePoint = { label: string; revenue: number; orders: number };

/** The mockup's plot box. preserveAspectRatio="none" stretches it to the panel. */
const VIEW_W = 1000;
const VIEW_H = 240;

/** Four rules plus the baseline, and the five sparse date ticks under the bars. */
const FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;

const at = <T,>(list: readonly T[], fraction: number): T | undefined =>
  list[Math.min(list.length - 1, Math.round(fraction * (list.length - 1)))];

/**
 * Revenue as a filled area with a line along its top edge, the daily order count
 * as a separate bar row beneath it, and sparse mono date ticks. Hand-rolled SVG:
 * it renders on the server, so the dashboard ships no charting bundle. The
 * legend lives in the panel header — see the dashboard page.
 */
export function RevenueOrdersChart({
  data,
  summary,
}: {
  data: readonly RevenuePoint[];
  /** Accessible name for the whole plot; the figures the picture encodes. */
  summary: string;
}) {
  // The mockup leaves 12% headroom above the peak so the line never touches the top.
  const revenueTop = Math.max(...data.map((point) => point.revenue), 0) * 1.12 || 1;
  const peakOrders = Math.max(...data.map((point) => point.orders), 0);

  const line = data
    .map((point, index) => {
      const x = (index / Math.max(1, data.length - 1)) * VIEW_W;
      const y = VIEW_H - (point.revenue / revenueTop) * VIEW_H;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="dash-chart" role="img" aria-label={summary}>
      <svg
        className="dash-chart-plot"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden
        focusable="false"
      >
        {FRACTIONS.map((fraction) => (
          <line
            key={fraction}
            x1="0"
            x2={VIEW_W}
            y1={fraction * VIEW_H}
            y2={fraction * VIEW_H}
            stroke={CHART_COLORS.ruleFaint}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={`${line} L${VIEW_W} ${VIEW_H} L0 ${VIEW_H} Z`} fill={CHART_COLORS.areaFill} />
        <path
          d={line}
          fill="none"
          stroke={CHART_COLORS.accent}
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="dash-chart-bars" aria-hidden>
        {data.map((point, index) => (
          <span
            key={index}
            style={{ blockSize: `${peakOrders === 0 ? 3 : Math.max(3, (point.orders / peakOrders) * 100)}%` }}
          />
        ))}
      </div>

      <div className="dash-chart-ticks" aria-hidden>
        {FRACTIONS.map((fraction) => (
          <span key={fraction}>{at(data, fraction)?.label ?? ""}</span>
        ))}
      </div>
    </div>
  );
}
