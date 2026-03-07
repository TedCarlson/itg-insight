"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Card } from "@/components/ui/Card";
import { formatValue, toNumberOrNull } from "@/features/metrics/lib/reports/format";

type AnyRow = Record<string, any>;

type KpiDefLike = {
  kpi_key: string;
  kpi_name?: string | null;
  label?: string | null;
  format?: string | null;
  decimals?: number | null;
};

type Props = {
  okRows: AnyRow[];
  nonOkRows: AnyRow[];

  kpis: KpiDefLike[];

  personNameById: Map<string, string>;
  personMetaById: Map<string, any>;
  preset: any;

  latestMetricDate: string;
  priorMetricDate: string | null;
  priorSnapshotByTechId: Map<string, any>;
};

type BandKey = "EXCEEDS" | "MEETS" | "NEEDS_IMPROVEMENT" | "MISSES" | "NO_DATA";

function bandKeyNorm(v: unknown): BandKey {
  const s = String(v ?? "").toUpperCase();
  if (s === "EXCEEDS" || s === "MEETS" || s === "NEEDS_IMPROVEMENT" || s === "MISSES" || s === "NO_DATA") return s;
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

function pickPresetBandStyle(
  preset: any,
  band: BandKey
): { borderColor?: string; backgroundColor?: string; color?: string } {
  const direct = preset?.[band] ?? null;
  if (direct && typeof direct === "object") {
    const border = String((direct as any).border_color ?? "");
    const bg = String((direct as any).bg_color ?? "");
    const ink = String((direct as any).text_color ?? "");

    const out: any = {};
    if (border) out.borderColor = border;
    if (bg) out.backgroundColor = bg;
    if (ink) out.color = isWhiteLike(ink) ? "var(--to-ink)" : ink;
    if (Object.keys(out).length) return out;
  }

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

function fallbackBandStyle(band: BandKey): { borderColor: string; backgroundColor: string } {
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
      return { borderColor: "var(--to-border)", backgroundColor: "var(--to-surface)" };
  }
}

function metricAndBandFromJson(row: AnyRow, kpi_key: string): { value: number | null; band_key: BandKey } {
  const comp = row?.computed_metrics_json ?? null;
  const raw = row?.raw_metrics_json ?? null;

  const v =
    (comp && typeof comp === "object" ? (comp as any)[kpi_key] : undefined) ??
    (raw && typeof raw === "object" ? (raw as any)[kpi_key] : undefined);

  if (v == null) return { value: null, band_key: "NO_DATA" };

  if (typeof v === "object" && v !== null) {
    const vv = (v as any).value;
    const bk = bandKeyNorm((v as any).band_key);
    const n = toNumberOrNull(vv);
    return { value: n, band_key: bk };
  }

  const n = toNumberOrNull(v);
  return { value: n, band_key: "NO_DATA" };
}

function inferredDigits(kpi: KpiDefLike): number {
  if (kpi.decimals != null && Number.isFinite(Number(kpi.decimals))) return Number(kpi.decimals);

  const key = String(kpi.kpi_key ?? "").toUpperCase();
  const label = String(kpi.label ?? kpi.kpi_name ?? "").toUpperCase();

  const isTNPS = key.includes("TNPS") || label.includes("TNPS");
  if (isTNPS) return 2;

  return 1;
}

function fmt(v: number | null, kpi: KpiDefLike): string {
  if (v == null) return "—";
  const digits = inferredDigits(kpi);
  return formatValue({ value: v, format: "NUM", decimals: digits });
}

function kpiLabel(k: KpiDefLike): string {
  return String(k.label ?? k.kpi_name ?? k.kpi_key);
}

function BandPill({ preset, band, children }: { preset: any; band: BandKey; children: React.ReactNode }) {
  const presetStyle = pickPresetBandStyle(preset, band);
  const hasPreset = Object.keys(presetStyle).length > 0;
  const s = hasPreset ? presetStyle : fallbackBandStyle(band);

  return (
    <div
      className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap"
      style={s}
      title={band}
    >
      {children}
    </div>
  );
}

function fmtWs100(v: unknown): string {
  const n = toNumberOrNull(v);
  if (n == null) return "—";
  return formatValue({ value: n * 100, format: "SCORE", decimals: 3 });
}

function pctOf(total: number | null, part: number | null): string {
  if (total == null || total <= 0 || part == null) return "—";
  const pct = (part / total) * 100;
  return formatValue({ value: pct, format: "PCT", decimals: 1 });
}

type RawField =
  | "Total Jobs"
  | "Installs"
  | "TCs"
  | "SROs"
  | "TUResult"
  | "TUEligibleJobs"
  | "ToolUsage"
  | "Promoters"
  | "Detractors"
  | "tNPS Surveys"
  | "tNPS Rate"
  | "FTRFailJobs"
  | "Total FTR/Contact Jobs"
  | "FTR%";

type FactCol = {
  field: RawField;
  label: string;
  kind: "COUNT" | "RATE";
  digits?: number;
};

function kpiGroup(k: KpiDefLike): "TNPS" | "FTR" | "TOOL" | "OTHER" {
  const key = String(k.kpi_key ?? "").toUpperCase();
  const label = String(k.label ?? k.kpi_name ?? "").toUpperCase();
  const s = `${key} ${label}`;
  if (s.includes("TNPS")) return "TNPS";
  if (s.includes("FTR")) return "FTR";
  if (s.includes("TOOL") || s.includes("USAGE") || s.includes("TU")) return "TOOL";
  return "OTHER";
}

function factColumnsForKpi(k: KpiDefLike): { groupLabel: string; cols: FactCol[] } {
  const g = kpiGroup(k);
  if (g === "TNPS") {
    return {
      groupLabel: "tNPS",
      cols: [
        { field: "tNPS Surveys", label: "Surveys", kind: "COUNT" },
        { field: "Promoters", label: "Promoters", kind: "COUNT" },
        { field: "Detractors", label: "Detractors", kind: "COUNT" },
        { field: "tNPS Rate", label: "tNPS Rate", kind: "RATE", digits: 2 },
      ],
    };
  }
  if (g === "FTR") {
    return {
      groupLabel: "FTR",
      cols: [
        { field: "Total FTR/Contact Jobs", label: "Eligible Jobs", kind: "COUNT" },
        { field: "FTRFailJobs", label: "Fail Jobs", kind: "COUNT" },
        { field: "FTR%", label: "FTR%", kind: "RATE", digits: 1 },
      ],
    };
  }
  if (g === "TOOL") {
    return {
      groupLabel: "Tool Usage",
      cols: [
        { field: "TUEligibleJobs", label: "Eligible Jobs", kind: "COUNT" },
        { field: "TUResult", label: "Compliant Jobs", kind: "COUNT" },
        { field: "ToolUsage", label: "ToolUsage", kind: "RATE", digits: 1 },
      ],
    };
  }

  return { groupLabel: kpiLabel(k), cols: [] };
}

function rawNumFromRow(row: AnyRow, field: RawField): number | null {
  const raw = row?.raw_metrics_json ?? null;
  const comp = row?.computed_metrics_json ?? null;

  const v =
    (raw && typeof raw === "object" ? (raw as any)[field] : undefined) ??
    (comp && typeof comp === "object" ? (comp as any)[field] : undefined) ??
    (row as any)?.[field];

  if (v && typeof v === "object") {
    const vv = (v as any).value;
    return toNumberOrNull(vv);
  }

  return toNumberOrNull(v);
}

function fmtFact(val: number | null, col: FactCol): string {
  if (val == null) return "—";
  if (col.kind === "COUNT") return formatValue({ value: val, format: "INT" });
  const digits = col.digits ?? 1;
  return formatValue({ value: val, format: "NUM", decimals: digits });
}

function fmtFactDelta(cur: number | null, prior: number | null, col: FactCol): string {
  if (cur == null || prior == null) return "—";
  const d = cur - prior;
  if (!Number.isFinite(d)) return "—";
  const sign = d > 0 ? "+" : "";
  if (col.kind === "COUNT") return `${sign}${formatValue({ value: d, format: "INT" })}`;
  const digits = col.digits ?? 1;
  return `${sign}${d.toFixed(digits)}`;
}

export default function ReportsTabbedTable(props: Props) {
  const { okRows, nonOkRows, kpis, preset, personNameById, priorSnapshotByTechId } = props;

  const [tab, setTab] = useState<"RANKING" | "OUTLIERS">("RANKING");
  const rows = tab === "RANKING" ? okRows : nonOkRows;

  const [expandedTechId, setExpandedTechId] = useState<string | null>(null);

  const tabs = useMemo(
    () => [
      { value: "RANKING", label: "Ranking" },
      { value: "OUTLIERS", label: "Outliers" },
    ],
    []
  );

  const drawerGroups = useMemo(() => {
    const groups = kpis.map(factColumnsForKpi).filter((g) => g.cols.length > 0);
    return groups;
  }, [kpis]);

  const drawerColsFlat = useMemo(() => {
    const flat: Array<FactCol & { groupLabel: string }> = [];
    for (const g of drawerGroups) {
      for (const c of g.cols) flat.push({ ...c, groupLabel: g.groupLabel });
    }
    return flat;
  }, [drawerGroups]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Metrics · Tech count {rows.length}</div>
        <SegmentedControl value={tab} onChange={(v) => setTab(v as any)} options={tabs} size="sm" />
      </div>

      <div className="mt-3 overflow-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--to-border)] text-[var(--to-ink-muted)]">
              <th className="text-left py-2 pr-3 font-medium">Tech</th>
              <th className="text-center py-2 px-3 font-medium">Rank</th>
              <th className="text-center py-2 px-3 font-medium">Weighted Score</th>

              {kpis.map((k) => (
                <th key={k.kpi_key} className="text-center py-2 px-3 font-medium whitespace-nowrap">
                  {kpiLabel(k)}
                </th>
              ))}

              <th className="text-center py-2 pl-3 font-medium whitespace-nowrap">Total Jobs</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, idx) => {
              const techId = String(r.tech_id ?? "—");
              const rank = r.rank_in_pc ?? r.rank_org ?? null;
              const score = r.weighted_score ?? r.composite_score ?? null;

              const totalJobs =
                metricAndBandFromJson(r, "total_jobs").value ??
                metricAndBandFromJson(r, "Total Jobs").value ??
                toNumberOrNull(r.total_jobs) ??
                null;

              const isOpen = expandedTechId === techId;
              const clickToggle = () => setExpandedTechId((cur) => (cur === techId ? null : techId));

              const personId = r.person_id ? String(r.person_id) : "";
              const fullName = personId ? personNameById.get(personId) ?? "—" : "—";
              const prior = priorSnapshotByTechId.get(techId) ?? null;

              const wmTotal = rawNumFromRow(r, "Total Jobs") ?? totalJobs;
              const installs = rawNumFromRow(r, "Installs");
              const tcs = rawNumFromRow(r, "TCs");
              const sros = rawNumFromRow(r, "SROs");

              const canOpenMirror = Boolean(personId);

              return (
                <Fragment key={`${techId}-${idx}`}>
                  <tr className={idx % 2 === 1 ? "bg-[var(--to-surface-2)]" : undefined}>
                    <td className="py-2 pr-3 font-medium">
                      <button
                        type="button"
                        onClick={clickToggle}
                        className="inline-flex items-center gap-2 hover:underline"
                        title="Show details"
                      >
                        <span className="font-mono">{techId}</span>
                        <span className="text-[11px] text-[var(--to-ink-muted)]">{isOpen ? "▾" : "▸"}</span>
                      </button>
                    </td>

                    <td className="py-2 px-3 text-center">
                      <button type="button" onClick={clickToggle} className="w-full hover:underline" title="Show details">
                        {rank ?? "—"}
                      </button>
                    </td>

                    <td className="py-2 px-3 text-center font-mono tabular-nums">
                      <button type="button" onClick={clickToggle} className="w-full hover:underline" title="Show details">
                        {fmtWs100(score)}
                      </button>
                    </td>

                    {kpis.map((k) => {
                      const { value, band_key } = metricAndBandFromJson(r, k.kpi_key);

                      if (band_key === "NO_DATA") {
                        return (
                          <td key={k.kpi_key} className="py-2 px-3 text-center">
                            {fmt(value, k)}
                          </td>
                        );
                      }

                      return (
                        <td key={k.kpi_key} className="py-2 px-3 text-center">
                          <BandPill preset={preset} band={band_key}>
                            {fmt(value, k)}
                          </BandPill>
                        </td>
                      );
                    })}

                    <td className="py-2 pl-3 text-center font-mono tabular-nums">
                      {wmTotal == null ? "—" : formatValue({ value: wmTotal, format: "INT" })}
                    </td>
                  </tr>

                  {isOpen ? (
                    <tr className={idx % 2 === 1 ? "bg-[var(--to-surface-2)]" : undefined}>
                      <td colSpan={4 + kpis.length} className="py-3">
                        <div className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-base font-semibold text-[var(--to-ink)]">{fullName}</div>

                                {canOpenMirror ? (
                                  <Link
                                    href={`/metrics/tech-scorecard/${personId}`}
                                    className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium text-[var(--to-ink-muted)] hover:bg-[var(--to-surface)]"
                                    title="Open technician mirror"
                                  >
                                    Open Scorecard
                                  </Link>
                                ) : null}
                              </div>

                              <div className="mt-0.5 text-xs text-[var(--to-ink-muted)]">
                                Tech <span className="font-mono">{techId}</span>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface)] px-4 py-2">
                              <div className="text-[11px] font-medium text-[var(--to-ink-muted)]">Work mix</div>
                              <div className="mt-2 grid grid-cols-4 gap-4 text-xs">
                                <div>
                                  <div className="text-[11px] text-[var(--to-ink-muted)]">Total</div>
                                  <div className="font-mono tabular-nums text-[var(--to-ink)]">
                                    {wmTotal == null ? "—" : formatValue({ value: wmTotal, format: "INT" })}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px] text-[var(--to-ink-muted)]">Installs</div>
                                  <div className="font-mono tabular-nums text-[var(--to-ink)]">
                                    {installs == null ? "—" : formatValue({ value: installs, format: "INT" })}{" "}
                                    <span className="text-[11px] text-[var(--to-ink-muted)]">({pctOf(wmTotal, installs)})</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px] text-[var(--to-ink-muted)]">TCs</div>
                                  <div className="font-mono tabular-nums text-[var(--to-ink)]">
                                    {tcs == null ? "—" : formatValue({ value: tcs, format: "INT" })}{" "}
                                    <span className="text-[11px] text-[var(--to-ink-muted)]">({pctOf(wmTotal, tcs)})</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px] text-[var(--to-ink-muted)]">SROs</div>
                                  <div className="font-mono tabular-nums text-[var(--to-ink)]">
                                    {sros == null ? "—" : formatValue({ value: sros, format: "INT" })}{" "}
                                    <span className="text-[11px] text-[var(--to-ink-muted)]">({pctOf(wmTotal, sros)})</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 overflow-auto">
                            <table className="min-w-[980px] w-full text-sm">
                              <thead>
                                <tr className="border-b border-[var(--to-border)] text-[11px] text-[var(--to-ink-muted)]">
                                  <th className="py-2 pr-3 text-left font-medium">Row</th>
                                  {drawerGroups.map((g) => (
                                    <th
                                      key={g.groupLabel}
                                      className="py-2 px-3 text-center font-semibold whitespace-nowrap"
                                      colSpan={g.cols.length}
                                    >
                                      {g.groupLabel}
                                    </th>
                                  ))}
                                </tr>

                                <tr className="border-b border-[var(--to-border)] text-[11px] text-[var(--to-ink-muted)]">
                                  <th className="py-2 pr-3 text-left font-medium"> </th>
                                  {drawerColsFlat.map((c, i) => (
                                    <th key={`${c.groupLabel}-${c.field}-${i}`} className="py-2 px-3 text-center font-medium whitespace-nowrap">
                                      {c.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>

                              <tbody>
                                {(["Current", "Prior", "Delta"] as const).map((rowLabel) => {
                                  const isDelta = rowLabel === "Delta";

                                  return (
                                    <tr key={rowLabel} className="border-b border-[var(--to-border)] last:border-b-0">
                                      <td className="py-2 pr-3 text-left font-medium text-[var(--to-ink)]">{rowLabel}</td>

                                      {drawerColsFlat.map((c, i) => {
                                        const cur = rawNumFromRow(r, c.field);
                                        const pri = prior ? rawNumFromRow(prior, c.field) : null;

                                        let text = "—";
                                        if (isDelta) {
                                          text = fmtFactDelta(cur, pri, c);
                                        } else if (rowLabel === "Prior") {
                                          text = fmtFact(pri, c);
                                        } else {
                                          text = fmtFact(cur, c);
                                        }

                                        return (
                                          <td
                                            key={`${rowLabel}-${c.groupLabel}-${c.field}-${i}`}
                                            className="py-2 px-3 text-center font-mono tabular-nums text-[var(--to-ink)]"
                                          >
                                            {text}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-2 text-[11px] text-[var(--to-ink-muted)]">
                            Drawer shows raw payload fact fields only (no rank plumbing).
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}