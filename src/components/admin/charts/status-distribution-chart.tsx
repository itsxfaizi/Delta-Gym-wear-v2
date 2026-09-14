"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS, CHART_COLORS, TOOLTIP_STYLE } from "./palette";

export type StatusSlice = { label: string; count: number; tone: string };

const TONE_FILL: Record<string, string> = {
  neutral: CHART_COLORS.inkSoft,
  info: CHART_COLORS.ink,
  warn: CHART_COLORS.accent,
  danger: CHART_COLORS.danger,
  success: CHART_COLORS.ink,
};

export function StatusDistributionChart({ data }: { data: readonly StatusSlice[] }) {
  return (
    <div className="chart-frame" role="img" aria-label="Orders by COD status">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <XAxis type="number" {...AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="label" {...AXIS} tickLine={false} axisLine={false} width={128} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [String(value), "Orders"]} />
          <Bar dataKey="count" name="Orders" maxBarSize={18}>
            {data.map((slice) => (
              <Cell key={slice.label} fill={TONE_FILL[slice.tone] ?? CHART_COLORS.inkSoft} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
