// path: apps/web/src/features/role-company-manager/server/buildCompanyManagerRollupReportPayload.server.ts

import {
  buildScopedRows,
  mapTeamRows,
  type TeamRowClient,
} from "@/shared/lib/metrics/buildScopedRows";
import { buildScopedExecutiveStrip } from "@/shared/lib/metrics/buildScopedExecutiveStrip";
import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

type TeamClass = "ITG" | "BP";
type ReportClass = "NSR" | "SMART";
type ReportRange = "FM" | "PREVIOUS" | "3FM" | "12FM";

type SupervisorRollupRow = {
  supervisor_person_id: string;
  supervisor_name: string;
  team_class: TeamClass;
  rollup_hc: number;
  composite_score: number | null;
  rank: number;
  kpis: Array<{
    kpi_key: string;
    label: string;
    value: number | null;
    value_display: string;
    band_key: string | null;
  }>;
};

export type ManagerRollupReportPayload = {
  header: {
    generated_at: string;
    class_type: ReportClass;
    range: ReportRange;
    org_display: string | null;
  };
  segments: {
    itg_supervisors: SupervisorRollupRow[];
    bp_supervisors: SupervisorRollupRow[];
    all_supervisors: SupervisorRollupRow[];
  };
};

function getUniqueSupervisors(rows: TeamRowClient[]) {
  const map = new Map<string, string>();

  for (const row of rows) {
    const id = String(row.reports_to_person_id ?? "").trim();
    if (!id) continue;

    const label = String(row.reports_to_label ?? "").trim() || id;
    if (!map.has(id)) map.set(id, label);
  }

  return [...map.entries()].map(([id, label]) => ({
    supervisor_person_id: id,
    supervisor_name: label,
  }));
}

function inferTeamClass(args: {
  supervisor_person_id: string;
  rows: TeamRowClient[];
}): TeamClass {
  const directRows = args.rows.filter(
    (row) =>
      String(row.reports_to_person_id ?? "").trim() ===
      args.supervisor_person_id
  );

  const hasCompanyDirect = directRows.some(
    (row) => String(row.affiliation_type ?? "").toUpperCase() === "COMPANY"
  );

  return hasCompanyDirect ? "ITG" : "BP";
}

function getDefinitionOrder(payload: MetricsSurfacePayload): string[] {
  const runtimeDefs = payload.executive_strip?.runtime?.definitions ?? [];

  if (runtimeDefs.length) {
    return runtimeDefs
      .map((definition: any) => String(definition.kpi_key ?? "").trim())
      .filter(Boolean);
  }

  return (payload.team_table.columns ?? [])
    .map((column) => String(column.kpi_key ?? "").trim())
    .filter(Boolean);
}

function getVisibleKpiKeys(args: {
  payload: MetricsSurfacePayload;
  class_type: ReportClass;
}) {
  const ordered = getDefinitionOrder(args.payload);
  const limit = args.class_type === "SMART" ? 7 : 4;
  return ordered.slice(0, limit);
}

function getKpiLabel(args: { payload: MetricsSurfacePayload; kpi_key: string }) {
  const runtimeDefs = args.payload.executive_strip?.runtime?.definitions ?? [];
  const runtimeDef = runtimeDefs.find(
    (definition: any) => definition.kpi_key === args.kpi_key
  );

  if (runtimeDef?.customer_label) return String(runtimeDef.customer_label);
  if (runtimeDef?.label) return String(runtimeDef.label);

  const column = args.payload.team_table.columns.find(
    (c) => c.kpi_key === args.kpi_key
  );

  return column?.label ?? args.kpi_key;
}

function readNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const cleaned = value.replace(/[,%]/g, "").trim();
    if (!cleaned || cleaned === "—") return null;

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readExecutiveValue(item: any): number | null {
  return (
    readNumeric(item?.value_numeric) ??
    readNumeric(item?.metric_value) ??
    readNumeric(item?.value) ??
    readNumeric(item?.raw_value) ??
    readNumeric(item?.current_value) ??
    readNumeric(item?.value_display)
  );
}

function formatMetricValue(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function findMetric(row: TeamRowClient, kpiKey: string): any | null {
  return (
    (row.metrics ?? []).find((metric: any) => metric.metric_key === kpiKey) ??
    null
  );
}

function aggregateMetricFromRows(rows: TeamRowClient[], kpiKey: string) {
  let numerator = 0;
  let denominator = 0;
  let valueTotal = 0;
  let valueCount = 0;

  for (const row of rows) {
    const metric = findMetric(row, kpiKey);
    if (!metric) continue;

    const n = readNumeric(metric.numerator);
    const d = readNumeric(metric.denominator);

    if (n != null && d != null && d > 0) {
      numerator += n;
      denominator += d;
      continue;
    }

    const value = readNumeric(metric.metric_value);
    if (value != null) {
      valueTotal += value;
      valueCount++;
    }
  }

  if (denominator > 0) return numerator / denominator;
  if (valueCount > 0) return valueTotal / valueCount;

  return null;
}

function computeComposite(rows: TeamRowClient[]) {
  let total = 0;
  let count = 0;

  for (const row of rows) {
    const value = readNumeric(row.composite_score);
    if (value == null) continue;

    total += value;
    count++;
  }

  return count > 0 ? total / count : null;
}

function buildKpis(args: {
  payload: MetricsSurfacePayload;
  rows: TeamRowClient[];
  executiveItems: any[];
  visibleKpiKeys: string[];
}) {
  return args.visibleKpiKeys.map((kpiKey) => {
    const executiveItem = args.executiveItems.find(
      (item: any) => item?.kpi_key === kpiKey
    );

    const value =
      readExecutiveValue(executiveItem) ??
      aggregateMetricFromRows(args.rows, kpiKey);

    return {
      kpi_key: kpiKey,
      label: getKpiLabel({ payload: args.payload, kpi_key: kpiKey }),
      value,
      value_display: formatMetricValue(value),
      band_key: executiveItem?.band_key ?? null,
    };
  });
}

function rankRows(rows: SupervisorRollupRow[]) {
  return [...rows]
    .sort((a, b) => {
      const av = a.composite_score;
      const bv = b.composite_score;

      if (bv == null && av == null) {
        return a.supervisor_name.localeCompare(b.supervisor_name);
      }

      if (bv == null) return -1;
      if (av == null) return 1;
      if (bv !== av) return bv - av;

      return a.supervisor_name.localeCompare(b.supervisor_name);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

export function buildCompanyManagerRollupReportPayload(args: {
  payload: MetricsSurfacePayload;
  class_type: ReportClass;
  range: ReportRange;
}): ManagerRollupReportPayload {
  const { payload, class_type, range } = args;

  const allRows = mapTeamRows(payload);
  const supervisors = getUniqueSupervisors(allRows);
  const visibleKpiKeys = getVisibleKpiKeys({ payload, class_type });

  const supervisorRows: SupervisorRollupRow[] = [];

  for (const supervisor of supervisors) {
    const rollupRows = buildScopedRows(allRows, {
      office_label: null,
      affiliation_type: null,
      contractor_name: null,
      reports_to_person_id: supervisor.supervisor_person_id,
      team_scope_mode: "ROLLUP",
    });

    if (!rollupRows.length) continue;

    const executiveItems = buildScopedExecutiveStrip({
      runtime: payload.executive_strip?.runtime ?? null,
      scopedRows: rollupRows,
      fallbackItems: payload.executive_strip?.scope?.items ?? [],
    });

    supervisorRows.push({
      supervisor_person_id: supervisor.supervisor_person_id,
      supervisor_name: supervisor.supervisor_name,
      team_class: inferTeamClass({
        supervisor_person_id: supervisor.supervisor_person_id,
        rows: rollupRows,
      }),
      rollup_hc: rollupRows.length,
      composite_score: computeComposite(rollupRows),
      rank: 0,
      kpis: buildKpis({
        payload,
        rows: rollupRows,
        executiveItems,
        visibleKpiKeys,
      }),
    });
  }

  return {
    header: {
      generated_at: new Date().toISOString(),
      class_type,
      range,
      org_display: payload.header.org_display,
    },
    segments: {
      itg_supervisors: rankRows(
        supervisorRows.filter((row) => row.team_class === "ITG")
      ),
      bp_supervisors: rankRows(
        supervisorRows.filter((row) => row.team_class === "BP")
      ),
      all_supervisors: rankRows(supervisorRows),
    },
  };
}