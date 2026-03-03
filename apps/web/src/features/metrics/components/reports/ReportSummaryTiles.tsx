// RUN THIS
// Replace the entire file:
// apps/web/src/features/metrics/components/reports/ReportSummaryTiles.tsx

"use client";

import { useMemo } from "react";
import { computeP4PTileRollup } from "@/features/metrics/lib/reports/rollup";

type UiRow = {
  tech_id?: string | null;

  // display KPIs (may exist, but tiles will NOT average these anymore)
  tnps_score?: number | null;
  ftr_rate?: number | null;
  tool_usage_rate?: number | null;

  status_badge?: string | null;

  // atomic facts (preferred)
  tnps_surveys?: number | null;
  tnps_promoters?: number | null;
  tnps_detractors?: number | null;

  total_ftr_contact_jobs?: number | null;
  ftr_fail_jobs?: number | null;

  tu_eligible_jobs?: number | null;
  tu_compliant_jobs?: number | null;

  // raw JSON fallback (your totals row proof shows these keys exist)
  raw_metrics_json?: any | null;
  computed_metrics_json?: any | null;
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
  // "Your view" (table scope)
  rows: UiRow[];
  priorRows: UiRow[];

  // Org snapshot (unfiltered ALL scope) — MUST be passed by the page to keep row 1 static
  orgRows?: UiRow[];
  priorOrgRows?: UiRow[];

  kpis: any[];
  preset: any;
  rubricRows: RubricRow[];
  rubricKeys: RubricKeys;
};

function finite(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  return null;
}

function isTotalsRow(row: any): boolean {
  const badge = String(row?.status_badge ?? "").toUpperCase();
  if (badge === "TOTALS") return true;
  const tech = String(row?.tech_id ?? "").toLowerCase();
  return tech.includes("totals");
}

function distinctTechCountOk(rows: UiRow[]): number {
  const s = new Set<string>();
  for (const r of rows) {
    if (String(r.status_badge ?? "") !== "OK") continue;
    if (isTotalsRow(r)) continue;
    const id = String(r.tech_id ?? "").trim();
    if (id) s.add(id);
  }
  return s.size;
}

function techIdSignature(rows: UiRow[]): string {
  // IMPORTANT: ignore totals row(s) so orgRows (which may include totals) can match view rows when no filter applied.
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (isTotalsRow(r)) continue;
    const id = String(r.tech_id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  ids.sort();
  return ids.join("|");
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

function bandFromRubric(rubricRows: RubricRow[], kpiKey: string, value: number | null): BandKey {
  if (value == null) return "NO_DATA";

  const rows = rubricRows.filter((r) => String(r.kpi_key ?? "") === String(kpiKey));
  if (!rows.length) return "NO_DATA";

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

function isWhiteLike(color: string): boolean {
  const s = String(color ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "#fff" || s === "#ffffff" || s === "white") return true;
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return false;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  return r >= 245 && g >= 245 && b >= 245;
}

function pickPresetBandStyle(preset: any, band: BandKey): { borderColor?: string; backgroundColor?: string; color?: string } {
  const b = preset?.bands?.[band] ?? preset?.bandStyles?.[band] ?? preset?.band?.[band] ?? null;

  const border = b?.border ?? b?.borderColor ?? b?.stroke ?? null;
  const bg = b?.bg ?? b?.background ?? b?.backgroundColor ?? null;
  const ink = b?.text ?? b?.color ?? b?.textColor ?? null;

  const out: any = {};
  if (typeof border === "string" && border) out.borderColor = border;
  if (typeof bg === "string" && bg) out.backgroundColor = bg;
  if (typeof ink === "string" && ink) out.color = isWhiteLike(ink) ? "var(--to-ink)" : ink;
  return out;
}

function fallbackBandStyle(band: BandKey) {
  switch (band) {
    case "EXCEEDS":
      return {
        borderColor: "color-mix(in oklab, var(--to-success) 55%, var(--to-border))",
        backgroundColor: "color-mix(in oklab, var(--to-success) 10%, var(--to-surface))",
      };
    case "MEETS":
      return {
        borderColor: "color-mix(in oklab, var(--to-info) 55%, var(--to-border))",
        backgroundColor: "color-mix(in oklab, var(--to-info) 10%, var(--to-surface))",
      };
    case "NEEDS_IMPROVEMENT":
      return {
        borderColor: "color-mix(in oklab, var(--to-warning) 55%, var(--to-border))",
        backgroundColor: "color-mix(in oklab, var(--to-warning) 10%, var(--to-surface))",
      };
    case "MISSES":
      return {
        borderColor: "color-mix(in oklab, var(--to-danger) 55%, var(--to-border))",
        backgroundColor: "color-mix(in oklab, var(--to-danger) 10%, var(--to-surface))",
      };
    default:
      return {
        borderColor: "var(--to-border)",
        backgroundColor: "var(--to-surface)",
      };
  }
}

function Tile({
  label,
  value,
  prior,
  digits = 1,
  band,
  preset,
}: {
  label: string;
  value: number | null;
  prior: number | null;
  digits?: number;
  band?: BandKey;
  preset: any;
}) {
  const d = delta(value, prior);
  const b = band ?? "NO_DATA";

  const presetStyle = pickPresetBandStyle(preset, b);
  const hasPreset = Object.keys(presetStyle).length > 0;
  const s = hasPreset ? presetStyle : fallbackBandStyle(b);

  return (
    <div className="rounded-2xl border px-4 py-2.5 shadow-sm" style={s as any}>
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
  preset,
}: {
  title: string;
  rows: UiRow[];
  priorRows: UiRow[];
  rubricRows: RubricRow[];
  keys: RubricKeys;
  preset: any;
}) {
  // Headcount is "officials" only (OK). Metrics are fact-driven across all rows (OK + outliers).
  const hc = distinctTechCountOk(rows);
  const hcPrior = distinctTechCountOk(priorRows);

  const cur = computeP4PTileRollup(rows);
  const prior = computeP4PTileRollup(priorRows);

  const tnps = finite(cur.tnps_rate);
  const tnpsPrior = finite(prior.tnps_rate);

  const ftr = finite(cur.ftr_rate);
  const ftrPrior = finite(prior.ftr_rate);

  const tool = finite(cur.tool_usage_rate);
  const toolPrior = finite(prior.tool_usage_rate);

  const tnpsBand = bandFromRubric(rubricRows, keys.tnpsKey, tnps);
  const ftrBand = bandFromRubric(rubricRows, keys.ftrKey, ftr);
  const toolBand = bandFromRubric(rubricRows, keys.toolKey, tool);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-[var(--to-ink-muted)]">{title}</div>

      <div className="grid gap-3 md:grid-cols-4">
        <HeadcountTile hc={hc} hcPrior={hcPrior} />
        <Tile label="tNPS" value={tnps} prior={tnpsPrior} digits={1} band={tnpsBand} preset={preset} />
        <Tile label="FTR%" value={ftr} prior={ftrPrior} digits={1} band={ftrBand} preset={preset} />
        <Tile label="Tool Usage%" value={tool} prior={toolPrior} digits={1} band={toolBand} preset={preset} />
      </div>
    </div>
  );
}

export default function ReportSummaryTiles(props: Props) {
  const orgRows = props.orgRows ?? null;
  const priorOrgRows = props.priorOrgRows ?? null;

  const memo = useMemo(() => {
    const orgSig = orgRows ? techIdSignature(orgRows) : null;
    const viewSig = orgRows ? techIdSignature(props.rows) : null;

    // Hide row 2 when no filter applied:
    // because orgRows may include totals but signature ignores totals, ALL should match and hide.
    const showSecondRow = orgSig != null && viewSig != null ? orgSig !== viewSig : true;

    return {
      showSecondRow,
      orgRows: orgRows ?? props.rows,
      priorOrgRows: priorOrgRows ?? props.priorRows,
      rows: props.rows,
      priorRows: props.priorRows,
    };
  }, [orgRows, priorOrgRows, props.rows, props.priorRows]);

  return (
    <div className="flex flex-col gap-4">
      <TileRow
        title="Org snapshot"
        rows={memo.orgRows}
        priorRows={memo.priorOrgRows}
        rubricRows={props.rubricRows}
        keys={props.rubricKeys}
        preset={props.preset}
      />

      {memo.showSecondRow ? (
        <TileRow
          title="Your view"
          rows={memo.rows}
          priorRows={memo.priorRows}
          rubricRows={props.rubricRows}
          keys={props.rubricKeys}
          preset={props.preset}
        />
      ) : null}
    </div>
  );
}