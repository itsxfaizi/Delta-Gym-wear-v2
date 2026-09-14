"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS, CHART_COLORS, TOOLTIP_STYLE } from "./palette";

export type DeliveryPoint = { label: string; delivered: number; failed: number };

export function DeliveryTrendChart({ data }: { data: readonly DeliveryPoint[] }) {
  return (
    <div className="chart-frame" role="img" aria-label="Delivered parcels against refused and returned parcels per day">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
          <XAxis dataKey="label" {...AXIS} tickLine={false} minTickGap={24} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend iconType="square" wrapperStyle={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.08em" }} />
          <Area
            type="monotone"
            dataKey="delivered"
            name="Delivered"
            stroke={CHART_COLORS.ink}
            fill={CHART_COLORS.accent}
            fillOpacity={0.45}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="failed"
            name="Refused or returned"
            stroke={CHART_COLORS.danger}
            fill={CHART_COLORS.danger}
            fillOpacity={0.18}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
