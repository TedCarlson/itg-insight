import { getTechShellContext } from "@/features/tech/lib/getTechShellContext";
import { supabaseServer } from "@/shared/data/supabase/server";
import { resolveMetricsRangeBatchIds } from "@/shared/server/metrics/resolveMetricsRangeBatchIds.server";
import { loadMetricScoreRows } from "@/shared/server/metrics/loadMetricScoreRows.server";
import { getMetricTnpsPayload } from "./getMetricTnpsPayload.server";
import { getMetricFtrPayload } from "./getMetricFtrPayload.server";
import { getMetricToolUsagePayload } from "./getMetricToolUsagePayload.server";
import { getMetricPurePassPayload } from "./getMetricPurePassPayload.server";
import { getMetric48HrPayload } from "./getMetric48HrPayload.server";
import { getMetricRepeatPayload } from "./getMetricRepeatPayload.server";
import { getMetricSoiPayload } from "./getMetricSoiPayload.server";
import { getMetricReworkPayload } from "./getMetricReworkPayload.server";
import { getMetricMetPayload } from "./getMetricMetPayload.server";

import type { ScorecardTile, ScorecardHeader } from "@/shared/kpis/core/scorecardTypes";
import type { KpiBandKey, KpiBandPaint, MetricsRangeKey } from "@/shared/kpis/core/types";

type Args = { range: MetricsRangeKey };

type OkPayload = {
  ok: true;
  range: MetricsRangeKey;
  header: ScorecardHeader;
  tiles: ScorecardTile[];
  ftrDebug: unknown | null;
  tnpsDebug: unknown | null;
  toolUsageDebug: unknown | null;
  purePassDebug: unknown | null;
  callback48HrDebug: unknown | null;
  repeatDebug: unknown | null;
  soiDebug: unknown | null;
  reworkDebug: unknown | null;
  metDebug: unknown | null;
};

type FailPayload = {
  ok: false;
  reason: string;
};

export type TechMetricsRangePayload = OkPayload | FailPayload;

type ProfileKpiRow = {
  metric_key: string | null;
  metric_label: string | null;
  display_label: string | null;
  customer_label: string | null;
  direction: string | null;
  report_order: number | null;
};

type WorkforceRow = {
  full_name: string | null;
  tech_id: string | null;
  affiliation: string | null;
  office_name: string | null;
  reports_to_full_name: string | null;
};

const PAINT: Record<KpiBandKey, KpiBandPaint> = {
  EXCEEDS: { preset: "green", bg: "#ecfdf5", ink: "#065f46", border: "#10b981" },
  MEETS: { preset: "green", bg: "#ecfdf5", ink: "#065f46", border: "#10b981" },
  NEEDS_IMPROVEMENT: { preset: "amber", bg: "#fffbeb", ink: "#92400e", border: "#f59e0b" },
  MISSES: { preset: "red", bg: "#fef2f2", ink: "#991b1b", border: "#ef4444" },
  NO_DATA: { preset: "slate", bg: "#f8fafc", ink: "#334155", border: "#cbd5e1" },
};

function clean(value: unknown) {
  return String(value ?? "").trim() || null;
}

function normalizeBandKey(value: unknown): KpiBandKey {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "EXCEEDS") return "EXCEEDS";
  if (raw === "MEETS") return "MEETS";
  if (raw === "NEEDS_IMPROVEMENT") return "NEEDS_IMPROVEMENT";
  if (raw === "MISSES") return "MISSES";
  return "NO_DATA";
}

function bandLabel(key: KpiBandKey) {
  if (key === "EXCEEDS") return "Exceeds";
  if (key === "MEETS") return "Meets";
  if (key === "NEEDS_IMPROVEMENT") return "Needs Improvement";
  if (key === "MISSES") return "Misses";
  return "No Data";
}

function formatValue(metricKey: string, value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  const key = metricKey.toLowerCase();
  if (key.includes("tnps")) return Math.round(value).toString();
  return `${value.toFixed(1)}%`;
}

function deriveTnpsDetractors(args: {
  value: number | null;
  promoters: number | null;
  surveys: number | null;
}) {
  if (
    args.value == null ||
    args.promoters == null ||
    args.surveys == null ||
    !Number.isFinite(args.value) ||
    !Number.isFinite(args.promoters) ||
    !Number.isFinite(args.surveys) ||
    args.surveys <= 0
  ) {
    return null;
  }

  return Math.max(0, Math.round(args.promoters - (args.value / 100) * args.surveys));
}

export async function getTechMetricsRangePayload(
  args: Args
): Promise<TechMetricsRangePayload> {
  const shell = await getTechShellContext();

  if (!shell.ok || !shell.pc_org_id || !shell.person_id || !shell.assignment_id) {
    return {
      ok: false,
      reason: shell.reason === "no_auth_user" ? "not_authenticated" : shell.reason,
    };
  }

  const sb = await supabaseServer();

  const { data: workforce, error: workforceError } = await sb
    .from("workforce_current_v")
    .select("full_name, tech_id, affiliation, office_name, reports_to_full_name")
    .eq("pc_org_id", shell.pc_org_id)
    .eq("person_id", shell.person_id)
    .eq("assignment_id", shell.assignment_id)
    .maybeSingle<WorkforceRow>();

  if (workforceError) throw new Error(workforceError.message);

  const techId = clean(workforce?.tech_id);
  if (!techId) return { ok: false, reason: "no_tech_id" };

  const [rangeResolution, profileKpiRes] = await Promise.all([
    resolveMetricsRangeBatchIds({
      pc_org_id: shell.pc_org_id,
      range: args.range,
    }),
    sb
      .from("metric_profile_kpis_v")
      .select("metric_key, metric_label, display_label, customer_label, direction, report_order")
      .eq("profile_key", "NSR")
      .eq("profile_is_active", true)
      .eq("metric_is_active", true)
      .eq("is_enabled", true)
      .order("report_order", { ascending: true })
      .order("metric_key", { ascending: true }),
  ]);

  if (profileKpiRes.error) throw new Error(profileKpiRes.error.message);

  const metricPayloadArgs = {
    person_id: shell.person_id,
    tech_id: techId,
    range: rangeResolution.active_range,
  };

  const [
    tnpsPayload,
    ftrPayload,
    toolUsagePayload,
    purePassPayload,
    callback48HrPayload,
    repeatPayload,
    soiPayload,
    reworkPayload,
    metPayload,
  ] = await Promise.all([
    getMetricTnpsPayload(metricPayloadArgs),
    getMetricFtrPayload(metricPayloadArgs),
    getMetricToolUsagePayload(metricPayloadArgs),
    getMetricPurePassPayload(metricPayloadArgs),
    getMetric48HrPayload(metricPayloadArgs),
    getMetricRepeatPayload(metricPayloadArgs),
    getMetricSoiPayload(metricPayloadArgs),
    getMetricReworkPayload(metricPayloadArgs),
    getMetricMetPayload(metricPayloadArgs),
  ]);

  const scoreRows = await loadMetricScoreRows({
    pc_org_id: shell.pc_org_id,
    profile_key: "NSR",
    metric_batch_ids: rangeResolution.batch_ids,
  });

  const techRows = scoreRows.filter((row) => row.tech_id === techId);
  const latestByMetric = new Map<string, (typeof techRows)[number]>();

  for (const row of techRows) {
    latestByMetric.set(row.metric_key, row);
  }

  const definitions = ((profileKpiRes.data ?? []) as ProfileKpiRow[])
    .map((row) => ({
      kpi_key: clean(row.metric_key),
      label:
        clean(row.customer_label) ??
        clean(row.display_label) ??
        clean(row.metric_label) ??
        clean(row.metric_key) ??
        "Metric",
      report_order: row.report_order ?? 999,
    }))
    .filter((row): row is { kpi_key: string; label: string; report_order: number } =>
      Boolean(row.kpi_key)
    );

  const tiles: ScorecardTile[] = definitions.map((def) => {
    const row = latestByMetric.get(def.kpi_key);
    const value = row?.metric_value ?? null;
    const bandKey = normalizeBandKey(row?.band_key);
    const isTnps = def.kpi_key.toLowerCase().includes("tnps");

    const denominator = row?.denominator ?? null;
    const numerator = row?.numerator ?? null;
    const detractors = isTnps
      ? deriveTnpsDetractors({
          value,
          promoters: numerator,
          surveys: denominator,
        })
      : null;

    return {
      kpi_key: def.kpi_key,
      label: def.label,
      value,
      value_display: formatValue(def.kpi_key, value),
      band: {
        band_key: bandKey,
        label: bandLabel(bandKey),
        paint: PAINT[bandKey],
      },
      momentum: {
        state: "not_available",
        delta: null,
        delta_display: null,
        arrow: null,
        windows: { short_days: 7, long_days: 30 },
        notes: null,
      },
      context: {
        sample_short: denominator,
        sample_long: numerator,
        meets_min_volume: null,
        detractors,
      },
    };
  });

  return {
    ok: true,
    range: rangeResolution.active_range,
    header: {
      person_id: shell.person_id,
      full_name: workforce?.full_name ?? null,
      affiliation: workforce?.affiliation ?? null,
      supervisor_name: workforce?.reports_to_full_name ?? null,
      tech_id: techId,
      pc_org_name: workforce?.office_name ?? null,
      fiscal_month_key: rangeResolution.active_range,
      fiscal_end_date: rangeResolution.as_of_date ?? undefined,
    },
    tiles,
    ftrDebug: ftrPayload?.debug ?? null,
    tnpsDebug: tnpsPayload?.debug ?? null,
    toolUsageDebug: toolUsagePayload?.debug ?? null,
    purePassDebug: purePassPayload?.debug ?? null,
    callback48HrDebug: callback48HrPayload?.debug ?? null,
    repeatDebug: repeatPayload?.debug ?? null,
    soiDebug: soiPayload?.debug ?? null,
    reworkDebug: reworkPayload?.debug ?? null,
    metDebug: metPayload?.debug ?? null,
  };
}
