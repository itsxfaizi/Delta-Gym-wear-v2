"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/money";

import { AXIS, CHART_COLORS, TOOLTIP_STYLE } from "./palette";

export type TopProductPoint = { productTitle: string; quantity: number; revenue: number };

export function TopProductsChart({ data, currency }: { data: readonly TopProductPoint[]; currency: string }) {
  return (
    <div className="chart-frame" role="img" aria-label="Best selling products by units sold">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <XAxis type="number" {...AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="productTitle" {...AXIS} tickLine={false} axisLine={false} width={128} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, _name, item) => [
              `${value} sold · ${formatMoney(Number((item?.payload as TopProductPoint | undefined)?.revenue ?? 0), currency)}`,
              "Units",
            ]}
          />
          <Bar dataKey="quantity" name="Units" fill={CHART_COLORS.ink} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
