// RUN THIS
// Replace the entire file:
// apps/web/src/features/metrics/components/reports/ReportSummaryTiles.tsx

"use client";

import { useMemo } from "react";

type UiRow = {
  tech_id?: string | null;

  tnps_score?: number | null;
  ftr_rate?: number | null;
  tool_usage_rate?: number | null;

  status_badge?: string | null;
};

type RubricKeys = {
  tnpsKey: string;
  ftrKey: string;
  toolKey: string;
};

type RubricRow = {
  class_type?: string | null;
  kpi_key: string;
  band_key: string;
  min_value: number | null;
  max_value: number | null;
  score_value: number | null;
};

type BandKey = "EXCEEDS" | "MEETS" | "NEEDS_IMPROVEMENT" | "MISSES" | "NO_DATA";

type Props = {
  // Tailored/filtered rows (viewer scope + reports_to filter)
  rows: UiRow[];
  priorRows: UiRow[];

  // Org-level pool (unscoped / not reports_to filtered)
  // If omitted, falls back to `rows`.
  orgRows?: UiRow[];
  priorOrgRows?: UiRow[];

  // kept for future / compatibility
  kpis: any[];
  preset: any; // present, but we don't rely on internal shape
  rubricRows: RubricRow[];
  rubricKeys: RubricKeys;
};

function finite(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  return null;
}

function avg(nums: Array<number | null | undefined>): number | null {
  let sum = 0;
  let c = 0;
  for (const v of nums) {
    const n = finite(v);
    if (n == null) continue;
    sum += n;
    c += 1;
  }
  if (!c) return null;
  return sum / c;
}

function distinctTechCount(rows: UiRow[]): number {
  const s = new Set<string>();
  for (const r of rows) {
    const id = String(r.tech_id ?? "").trim();
    if (id) s.add(id);
  }
  return s.size;
}

function fmtNum(n: number | null, digits = 1) {
  if (n == null) return "—";
  return n.toFixed(digits);
}

function delta(cur: number | null, prior: number | null) {
  if (cur == null || prior == null) return null;
  const d = cur - prior;
  if (!Number.isFinite(d)) return null;
  return d;
}

function Arrow({ d }: { d: number | null }) {
  if (d == null) return <span className="text-[var(--to-ink-muted)]">—</span>;
  if (d > 0) return <span className="text-[var(--to-success)]">↑</span>;
  if (d < 0) return <span className="text-[var(--to-danger)]">↓</span>;
  return <span className="text-[var(--to-ink-muted)]">→</span>;
}

function DeltaBadge({ d, digits = 1 }: { d: number | null; digits?: number }) {
  const val = d == null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(digits)}`;
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--to-border)] px-2 py-0.5 text-[11px] text-[var(--to-ink-muted)]">
      <Arrow d={d} />
      <span>Δ prior:</span>
      <span className="font-medium text-[var(--to-ink)]">{val}</span>
    </div>
  );
}

// --- banding (rubric-driven) ---
function bandFromRubric(rubricRows: RubricRow[], kpiKey: string, value: number | null): BandKey {
  if (value == null) return "NO_DATA";

  const rows = rubricRows.filter((r) => String(r.kpi_key ?? "") === String(kpiKey));
  if (!rows.length) return "NO_DATA";

  // normalize: prefer rows where min/max bound matches
  for (const r of rows) {
    const minOk = r.min_value == null || value >= Number(r.min_value);
    const maxOk = r.max_value == null || value <= Number(r.max_value);
    if (minOk && maxOk) {
      const b = String(r.band_key ?? "").toUpperCase();
      if (b === "EXCEEDS" || b === "MEETS" || b === "NEEDS_IMPROVEMENT" || b === "MISSES" || b === "NO_DATA") return b;
      return "NO_DATA";
    }
  }

  return "NO_DATA";
}

function bandStyle(band: BandKey) {
  // Uses your existing token palette (no dependency on preset shape).
  // Subtle tint + stronger border. This matches the “rubric behavior” feel.
  switch (band) {
    case "EXCEEDS":
      return {
        border: "color-mix(in oklab, var(--to-success) 55%, var(--to-border))",
        bg: "color-mix(in oklab, var(--to-success) 10%, var(--to-surface))",
      };
    case "MEETS":
      return {
        border: "color-mix(in oklab, var(--to-info) 55%, var(--to-border))",
        bg: "color-mix(in oklab, var(--to-info) 10%, var(--to-surface))",
      };
    case "NEEDS_IMPROVEMENT":
      return {
        border: "color-mix(in oklab, var(--to-warning) 55%, var(--to-border))",
        bg: "color-mix(in oklab, var(--to-warning) 10%, var(--to-surface))",
      };
    case "MISSES":
      return {
        border: "color-mix(in oklab, var(--to-danger) 55%, var(--to-border))",
        bg: "color-mix(in oklab, var(--to-danger) 10%, var(--to-surface))",
      };
    default:
      return {
        border: "var(--to-border)",
        bg: "var(--to-surface)",
      };
  }
}

function Tile({
  label,
  value,
  prior,
  digits = 1,
  band,
}: {
  label: string;
  value: number | null;
  prior: number | null;
  digits?: number;
  band?: BandKey;
}) {
  const d = delta(value, prior);
  const s = band ? bandStyle(band) : bandStyle("NO_DATA");

  return (
    <div
      className={["rounded-2xl border bg-[var(--to-surface)] px-4 py-2.5 shadow-sm"].join(" ")}
      style={{ borderColor: s.border, backgroundColor: s.bg }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-[var(--to-ink-muted)]">{label}</div>
        <DeltaBadge d={d} digits={digits} />
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-xl font-semibold text-[var(--to-ink)] leading-none">{value == null ? "—" : fmtNum(value, digits)}</div>
        <div className="text-[11px] text-[var(--to-ink-muted)] leading-none">
          Prior: <span className="font-medium text-[var(--to-ink)]">{prior == null ? "—" : fmtNum(prior, digits)}</span>
        </div>
      </div>
    </div>
  );
}

function HeadcountTile({ hc, hcPrior }: { hc: number; hcPrior: number }) {
  const d = hcPrior ? hc - hcPrior : null;
  return (
    <div className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface)] px-4 py-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-[var(--to-ink-muted)]">Headcount</div>
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--to-border)] px-2 py-0.5 text-[11px] text-[var(--to-ink-muted)]">
          <Arrow d={d} />
          <span>Δ prior:</span>
          <span className="font-medium text-[var(--to-ink)]">{d == null ? "—" : String(d)}</span>
        </div>
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-xl font-semibold text-[var(--to-ink)] leading-none">{hc}</div>
        <div className="text-[11px] text-[var(--to-ink-muted)] leading-none">
          Prior: <span className="font-medium text-[var(--to-ink)]">{hcPrior || "—"}</span>
        </div>
      </div>
    </div>
  );
}

function TileRow({
  title,
  rows,
  priorRows,
  rubricRows,
  keys,
}: {
  title: string;
  rows: UiRow[];
  priorRows: UiRow[];
  rubricRows: RubricRow[];
  keys: RubricKeys;
}) {
  const okRows = rows.filter((r) => String(r.status_badge ?? "") === "OK");
  const okPrior = priorRows.filter((r) => String(r.status_badge ?? "") === "OK");

  const hc = distinctTechCount(okRows);
  const hcPrior = distinctTechCount(okPrior);

  const tnps = avg(okRows.map((r) => r.tnps_score));
  const tnpsPrior = avg(okPrior.map((r) => r.tnps_score));

  const ftr = avg(okRows.map((r) => r.ftr_rate));
  const ftrPrior = avg(okPrior.map((r) => r.ftr_rate));

  const tool = avg(okRows.map((r) => r.tool_usage_rate));
  const toolPrior = avg(okPrior.map((r) => r.tool_usage_rate));

  const tnpsBand = bandFromRubric(rubricRows, keys.tnpsKey, tnps);
  const ftrBand = bandFromRubric(rubricRows, keys.ftrKey, ftr);
  const toolBand = bandFromRubric(rubricRows, keys.toolKey, tool);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-[var(--to-ink-muted)]">{title}</div>

      <div className="grid gap-3 md:grid-cols-4">
        <HeadcountTile hc={hc} hcPrior={hcPrior} />
        <Tile label="tNPS" value={tnps} prior={tnpsPrior} digits={2} band={tnpsBand} />
        <Tile label="FTR%" value={ftr} prior={ftrPrior} digits={1} band={ftrBand} />
        <Tile label="Tool Usage%" value={tool} prior={toolPrior} digits={1} band={toolBand} />
      </div>
    </div>
  );
}

export default function ReportSummaryTiles(props: Props) {
  const orgRows = props.orgRows ?? props.rows;
  const priorOrgRows = props.priorOrgRows ?? props.priorRows;

  const memo = useMemo(() => {
    return {
      orgRows,
      priorOrgRows,
      rows: props.rows,
      priorRows: props.priorRows,
    };
  }, [orgRows, priorOrgRows, props.rows, props.priorRows]);

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: ORG level (fixed row) */}
      <TileRow title="Org snapshot" rows={memo.orgRows} priorRows={memo.priorOrgRows} rubricRows={props.rubricRows} keys={props.rubricKeys} />

      {/* Row 2: Tailored row */}
      <TileRow title="Your view" rows={memo.rows} priorRows={memo.priorRows} rubricRows={props.rubricRows} keys={props.rubricKeys} />
    </div>
  );
}