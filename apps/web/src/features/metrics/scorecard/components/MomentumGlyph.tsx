import type { ScorecardTile } from "../lib/scorecard.types";

export default function MomentumGlyph(props: { momentum: ScorecardTile["momentum"] }) {
  const m = props.momentum;

  const glyph = m.arrow === "UP" ? "▲" : m.arrow === "DOWN" ? "▼" : "—";
  const text = m.delta_display ?? "—";

  const hint =
    m.state === "UP"
      ? "Improving"
      : m.state === "DOWN"
        ? "Softening"
        : m.state === "AT_RISK"
          ? "At risk"
          : m.state === "FLAT"
            ? "Stable"
            : "No data";

  return (
    <div className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground" title={hint}>
      <span className="leading-none">{glyph}</span>
      <span>{text}</span>
    </div>
  );
}