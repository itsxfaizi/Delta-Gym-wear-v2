/** Hex mirrors of the globals.css tokens: SVG presentation attributes cannot read var(). */
export const CHART_COLORS = {
  ink: "#101114",
  inkSoft: "#4f5053",
  accent: "#fdb515",
  danger: "#8a1c1c",
  border: "#d9d9d9",
  surface: "#f3f3f3",
} as const;

export const AXIS = {
  stroke: CHART_COLORS.inkSoft,
  fontSize: 11,
  fontFamily: "inherit",
} as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    border: `1px solid ${CHART_COLORS.ink}`,
    borderRadius: 0,
    background: "#ffffff",
    fontSize: "0.75rem",
  },
  labelStyle: { fontWeight: 700, letterSpacing: "0.04em" },
  cursor: { fill: CHART_COLORS.surface },
} as const;
