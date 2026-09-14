"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/money";

import { AXIS, CHART_COLORS, TOOLTIP_STYLE } from "./palette";

export type RevenuePoint = { label: string; revenue: number; orders: number };

export function RevenueOrdersChart({ data, currency }: { data: readonly RevenuePoint[]; currency: string }) {
  return (
    <div className="chart-frame" role="img" aria-label="Revenue and order count per day">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
          <XAxis dataKey="label" {...AXIS} tickLine={false} minTickGap={24} />
          <YAxis
            yAxisId="revenue"
            {...AXIS}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value: number) => (value / 100).toLocaleString("en-PK")}
          />
          <YAxis yAxisId="orders" orientation="right" {...AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, name) =>
              name === "Revenue" ? [formatMoney(Number(value), currency), "Revenue"] : [String(value), "Orders"]
            }
          />
          <Legend iconType="square" wrapperStyle={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.08em" }} />
          <Bar yAxisId="orders" dataKey="orders" name="Orders" fill={CHART_COLORS.accent} maxBarSize={18} />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={CHART_COLORS.ink}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
