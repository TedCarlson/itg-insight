import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

import { getTechScorecardPayload } from "@/features/metrics/scorecard/lib/getTechScorecardPayload.server";
import type {
  BandKey,
  ScorecardResponse,
  ScorecardTile,
} from "@/features/metrics/scorecard/lib/scorecard.types";

export type MetricsRangeKey = "FM" | "3FM" | "12FM";

type Args = {
  person_id: string;
  range: MetricsRangeKey;
};

type RubricRow = {
  kpi_key: string;
  band_key: BandKey;
  min_value: number | null;
  max_value: number | null;
  score_value: number | null;
};

function numOrNull(x: unknown): number | null {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function formatValueDisplay(kpiKey: string, value: number | null): string | null {
  if (value === null) return null;

  const lower = kpiKey.toLowerCase();
  const looksLikeRate =
    lower.endsWith("_rate") ||
    lower.endsWith("_pct") ||
    lower.includes("rate") ||
    lower.includes("pct");

  if (looksLikeRate) {
    const pct = value <= 1.5 ? value * 100 : value;
    return `${pct.toFixed(pct >= 10 ? 0 : 1)}%`;
  }

  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function paintForBand(band: BandKey) {
  switch (band) {
    case "EXCEEDS":
      return {
        preset: "BAND_EXCEEDS",
        bg: "var(--to-surface-2)",
        border: "var(--to-success)",
        ink: null,
      };
    case "MEETS":
      return {
        preset: "BAND_MEETS",
        bg: "var(--to-surface-2)",
        border: "var(--to-primary)",
        ink: null,
      };
    case "NEEDS_IMPROVEMENT":
      return {
        preset: "BAND_NEEDS_IMPROVEMENT",
        bg: "var(--to-surface-2)",
        border: "var(--to-warning)",
        ink: null,
      };
    case "MISSES":
      return {
        preset: "BAND_MISSES",
        bg: "var(--to-surface-2)",
        border: "var(--to-danger)",
        ink: null,
      };
    default:
      return {
        preset: "BAND_NO_DATA",
        bg: "var(--to-surface-2)",
        border: "var(--to-border)",
        ink: null,
      };
  }
}

function pickBand(
  value: number | null,
  bands: RubricRow[] | null | undefined
): BandKey {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "NO_DATA";
  }
  if (!bands || bands.length === 0) {
    return "NO_DATA";
  }

  for (const b of bands) {
    const minOk = b.min_value === null || value >= b.min_value;
    const maxOk = b.max_value === null || value <= b.max_value;
    if (minOk && maxOk) return b.band_key;
  }

  return "NO_DATA";
}

async function loadRubricRows(
  sbAdmin: ReturnType<typeof supabaseAdmin>,
  kpiKeys: string[]
): Promise<Map<string, RubricRow[]>> {
  if (!kpiKeys.length) return new Map();

  const { data } = await sbAdmin
    .from("metrics_kpi_rubric")
    .select("kpi_key,band_key,min_value,max_value,score_value")
    .eq("is_active", true)
    .in("kpi_key", kpiKeys);

  const out = new Map<string, RubricRow[]>();

  for (const r of (data ?? []) as any[]) {
    const k = String(r.kpi_key ?? "").trim();
    if (!k) continue;

    const row: RubricRow = {
      kpi_key: k,
      band_key: r.band_key,
      min_value: r.min_value,
      max_value: r.max_value,
      score_value: r.score_value,
    };

    const arr = out.get(k) ?? [];
    arr.push(row);
    out.set(k, arr);
  }

  return out;
}

function dedupeLatestRowPerFiscalMonth(rows: any[]): any[] {
  const byFiscal = new Map<string, any>();

  for (const row of rows) {
    const fiscal = String(row?.fiscal_end_date ?? "").slice(0, 10);
    if (!fiscal) continue;

    if (!byFiscal.has(fiscal)) {
      byFiscal.set(fiscal, row);
    }
  }

  return Array.from(byFiscal.values());
}

function monthsToTake(range: MetricsRangeKey): number {
  if (range === "3FM") return 3;
  if (range === "12FM") return 12;
  return 1;
}

function averageForKpi(rows: any[], kpiKey: string): number | null {
  const nums = rows
    .map((r) => numOrNull(r?.[kpiKey]))
    .filter((v): v is number => v !== null);

  if (!nums.length) return null;

  const sum = nums.reduce((acc, n) => acc + n, 0);
  return sum / nums.length;
}

function rangeLabel(range: MetricsRangeKey, fallback: string): string {
  if (range === "FM") return fallback;
  if (range === "3FM") return "Last 3 FM";
  return "Last 12 FM";
}

export async function getTechMetricsRangePayload(
  args: Args
): Promise<ScorecardResponse> {
  const base = await getTechScorecardPayload({ person_id: args.person_id });

  if (args.range === "FM") {
    return base;
  }

  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) {
    return base;
  }

  const tech_id = base.header.tech_id;
  if (!tech_id) {
    return base;
  }

  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const kpiKeys = base.tiles.map((t) => t.kpi_key);
  const rubricByKpi = await loadRubricRows(admin, kpiKeys);

  const { data: rawRows } = await sb
    .from("metrics_tech_fact_day")
    .select("*")
    .eq("pc_org_id", scope.selected_pc_org_id)
    .eq("tech_id", tech_id)
    .order("fiscal_end_date", { ascending: false })
    .order("metric_date", { ascending: false })
    .limit(1000);

  const latestRowsByMonth = dedupeLatestRowPerFiscalMonth((rawRows ?? []) as any[]);
  const selectedRows = latestRowsByMonth.slice(0, monthsToTake(args.range));

  if (!selectedRows.length) {
    return {
      ...base,
      header: {
        ...base.header,
        fiscal_month_key: rangeLabel(args.range, base.header.fiscal_month_key),
      },
    };
  }

  const tiles: ScorecardTile[] = base.tiles.map((tile) => {
    const value = averageForKpi(selectedRows, tile.kpi_key);
    const band_key = pickBand(value, rubricByKpi.get(tile.kpi_key));

    return {
      ...tile,
      value,
      value_display: formatValueDisplay(tile.kpi_key, value),
      band: {
        band_key,
        label: band_key.replaceAll("_", " "),
        paint: paintForBand(band_key),
      },
    };
  });

  return {
    ...base,
    header: {
      ...base.header,
      fiscal_month_key: rangeLabel(args.range, base.header.fiscal_month_key),
    },
    tiles,
  };
}