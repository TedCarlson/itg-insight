"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/state/org";
import type { ScorecardTile } from "../lib/scorecard.types";

type FiscalWindow = "FM" | "3FM" | "12FM";

type TrendPoint = {
  fiscal_month: string;
  metric_date: string;
  value: number | null;
  sample: number | null;
};

type TrendResponse = {
  series: TrendPoint[];
};

function parsePersonIdFromPath(): string | null {
  try {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "tech-scorecard");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return null;
  } catch {
    return null;
  }
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function looksLikeRate(kpiKey: string) {
  const lower = kpiKey.toLowerCase();
  return lower.endsWith("_rate") || lower.endsWith("_pct") || lower.includes("rate") || lower.includes("pct");
}

function fmtValue(kpiKey: string, v: number | null): string {
  if (!isFiniteNum(v)) return "—";
  if (looksLikeRate(kpiKey)) {
    const pct = v <= 1.5 ? v * 100 : v;
    return `${pct.toFixed(pct >= 10 ? 0 : 1)}%`;
  }
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function fmtDate(s: string) {
  return String(s || "").slice(0, 10) || "—";
}

function fmtFiscalMonth(s: string) {
  return String(s || "").trim() || "—";
}

function sampleLabelForKpi(kpiKey: string) {
  switch (kpiKey) {
    case "ftr_rate":
      return "FTR Jobs";
    case "tool_usage_rate":
      return "TU Eligible";
    case "tnps_score":
      return "Surveys";
    case "met_rate":
      return "MET Appts";
    case "contact_48hr_rate":
      return "48hr Jobs";
    case "pht_pure_pass_rate":
      return "Jobs";
    case "soi_rate":
      return "Jobs";
    case "repeat_rate":
      return "Jobs";
    case "rework_rate":
      return "Jobs";
    default:
      return "Count";
  }
}

export default function KpiStatsGrid(props: {
  tile: ScorecardTile;
  fiscalWindow: FiscalWindow;
}) {
  const { tile, fiscalWindow } = props;
  const { selectedOrgId } = useOrg();

  const personId = parsePersonIdFromPath();

  const [data, setData] = useState<TrendResponse>({ series: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function run() {
      if (!selectedOrgId || !personId) {
        if (alive) setData({ series: [] });
        return;
      }

      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("pc_org_id", selectedOrgId);
        qs.set("person_id", personId);
        qs.set("kpi_key", tile.kpi_key);
        qs.set("fiscal_window", fiscalWindow);

        const res = await fetch(`/api/metrics/trend?${qs.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Detail request failed: ${res.status}`);

        const json = (await res.json()) as TrendResponse;
        if (alive) setData({ series: json.series ?? [] });
      } catch {
        if (alive) setData({ series: [] });
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [tile.kpi_key, fiscalWindow, personId, selectedOrgId]);

  const rows = useMemo(
    () => (data.series ?? []).filter((r) => r.value !== null || r.sample !== null),
    [data]
  );

  const sampleLabel = sampleLabelForKpi(tile.kpi_key);

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Period detail</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Fiscal month is the primary container. Metric dates are checkpoints inside it.
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${rows.length} rows`}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Fiscal Month</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Metric Date</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">{tile.label}</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">{sampleLabel}</th>
            </tr>
          </thead>

          <tbody>
            {rows.length > 0 ? (
              rows.map((row, idx) => (
                <tr key={`${row.fiscal_month}-${row.metric_date}-${idx}`} className="border-t">
                  <td className="px-3 py-2 tabular-nums">{fmtFiscalMonth(row.fiscal_month)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtDate(row.metric_date)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtValue(tile.kpi_key, row.value)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {isFiniteNum(row.sample) ? row.sample : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {loading ? "Loading period detail…" : "No period detail for the selected window."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}