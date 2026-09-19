/** Hex mirrors of the admin.css tokens: SVG presentation attributes cannot read var(). */
export const CHART_COLORS = {
  ink: "#101114",
  inkSoft: "#4f5053",
  accent: "#0f6f8c",
  accentMid: "#b6d4dc",
  accentSoft: "#cfe4ea",
  danger: "#8a1c1c",
  border: "#d9d9d9",
  surface: "#f3f3f3",
  /** The faint rules behind the revenue plot. */
  ruleFaint: "#ececec",
  /** The revenue area under its line: the accent at 10%. */
  areaFill: "rgba(15,111,140,0.1)",
} as const;
