// path: apps/web/src/features/role-company-manager/components/CompanyManagerScopedViewClient.tsx

"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import MetricsSmartHeader from "@/shared/surfaces/MetricsSmartHeader";
import MetricsControlsStrip from "@/shared/surfaces/MetricsControlsStrip";
import MetricsExecutiveKpiStrip from "@/shared/surfaces/MetricsExecutiveKpiStrip";
import MetricsRiskStrip from "@/shared/surfaces/MetricsRiskStrip";
import MetricsTeamPerformanceTableClient from "@/shared/surfaces/MetricsTeamPerformanceTableClient";
import MetricsTechDrillDrawer from "@/shared/surfaces/MetricsTechDrillDrawer";
import {
  buildScopedRows,
  mapTeamRows,
  type MetricsControlsValue,
} from "@/shared/lib/metrics/buildScopedRows";
import {
  buildScopedRiskInsights,
  buildScopedWorkMix,
} from "@/shared/lib/metrics/scopedComputations";
import { buildExecutiveKpis } from "@/shared/domain/metrics/buildExecutiveKpis";

import type { KpiBandKey } from "@/shared/kpis/core/types";
import type {
  InspectionMetricCell,
  WorkforceInspectionPayload,
} from "@/shared/kpis/contracts/inspectionTypes";
import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";
import type {
  MetricsExecutiveRuntimeRubricRow,
  MetricsScopedExecutiveKpiItem,
} from "@/shared/types/metrics/executiveStrip";

import { useScopedTeamControls } from "../hooks/useScopedTeamControls";
import { useManagerHeaderScope } from "../hooks/useManagerHeaderScope";

type Props = {
  payload: MetricsSurfacePayload;
};

type SupervisorOption = {
  value: string;
  label: string;
};

type ReportClassType = "NSR" | "SMART";
type MetricsRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function hasActiveExecutiveSlice(controls: MetricsControlsValue): boolean {
  return Boolean(
    controls.office_label ||
      controls.affiliation_type ||
      controls.contractor_name ||
      controls.reports_to_person_id
  );
}

function buildExecutiveComparisonTitle(controls: MetricsControlsValue): string {
  if (controls.reports_to_person_id) return "Scoped Team Comparison";
  if (controls.contractor_name) return "Scoped Contractor Comparison";
  if (controls.office_label) return "Scoped Office Comparison";
  return "Scoped Comparison";
}

function buildExecutiveComparisonSubtitle(
  controls: MetricsControlsValue
): string | null {
  const parts: string[] = [];

  if (controls.office_label) parts.push(`Office: ${controls.office_label}`);
  if (controls.affiliation_type) {
    parts.push(`Affiliation: ${controls.affiliation_type}`);
  }
  if (controls.contractor_name) {
    parts.push(`Contractor: ${controls.contractor_name}`);
  }
  if (controls.reports_to_person_id) {
    parts.push("Supervisor team selected");
  }
  if (controls.reports_to_person_id && controls.team_scope_mode) {
    const scopeLabel =
      controls.team_scope_mode === "ROLLUP"
        ? "Rollup"
        : controls.team_scope_mode === "AFFILIATION_DIRECT"
          ? "Affiliation Direct"
          : "Direct";
    parts.push(`Scope: ${scopeLabel}`);
  }

  return parts.length ? parts.join(" • ") : null;
}

function buildRubricMap(rows: MetricsExecutiveRuntimeRubricRow[]) {
  const map = new Map<string, MetricsExecutiveRuntimeRubricRow[]>();

  for (const row of rows) {
    if (!map.has(row.kpi_key)) {
      map.set(row.kpi_key, []);
    }
    map.get(row.kpi_key)!.push(row);
  }

  return map as Map<string, any[]>;
}

function buildInspectionContext(row: {
  tech_id?: string | null;
  office_label?: string | null;
  contractor_name?: string | null;
  affiliation_type?: string | null;
}) {
  const parts = [
    String(row.tech_id ?? "").trim(),
    String(row.office_label ?? "").trim(),
    String(row.contractor_name ?? "").trim(),
    String(row.affiliation_type ?? "").trim(),
  ].filter(Boolean);

  return parts.join(" • ") || "Technician Detail";
}

function normalizeBandKey(value: string | null | undefined): KpiBandKey {
  if (value === "EXCEEDS") return "EXCEEDS";
  if (value === "MEETS") return "MEETS";
  if (value === "NEEDS_IMPROVEMENT") return "NEEDS_IMPROVEMENT";
  if (value === "MISSES") return "MISSES";
  return "NO_DATA";
}

function orderInspectionMetrics(
  metrics: Array<{
    kpi_key: string;
    label: string;
    value: number | null;
    value_display: string | null;
    band_key: string;
  }>,
  orderedKpiKeys: string[]
): InspectionMetricCell[] {
  const orderMap = new Map<string, number>(
    orderedKpiKeys.map((kpiKey, index) => [kpiKey, index])
  );

  return [...metrics]
    .sort((a, b) => {
      const aOrder = orderMap.get(a.kpi_key) ?? 999;
      const bOrder = orderMap.get(b.kpi_key) ?? 999;

      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.label.localeCompare(b.label);
    })
    .map((metric) => ({
      kpi_key: metric.kpi_key,
      label: metric.label,
      value: metric.value,
      value_display: metric.value_display,
      band_key: normalizeBandKey(metric.band_key),
    }));
}

function normalizeClassType(value: string | null): ReportClassType {
  return value === "SMART" ? "SMART" : "NSR";
}

function normalizeRangeType(
  value: string | null | undefined,
  fallback: MetricsRangeKey
): MetricsRangeKey {
  if (value === "PREVIOUS") return "PREVIOUS";
  if (value === "3FM") return "3FM";
  if (value === "12FM") return "12FM";
  if (value === "FM") return "FM";
  return fallback;
}

function toRangeLabel(rangeKey: MetricsRangeKey): string {
  if (rangeKey === "FM") return "Current";
  if (rangeKey === "PREVIOUS") return "Previous";
  if (rangeKey === "3FM") return "Previous 3FM";
  return "Previous 12FM";
}

export default function CompanyManagerScopedViewClient({ payload }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [controls, setControls] = useState<MetricsControlsValue>({
    office_label: null,
    affiliation_type: null,
    contractor_name: null,
    reports_to_person_id: null,
    team_scope_mode: "ROLLUP",
  });

  const currentClass = normalizeClassType(searchParams.get("class_type"));
  const currentRange = normalizeRangeType(
    searchParams.get("range"),
    payload.filters.active_range
  );

  const allRows = useMemo(() => mapTeamRows(payload), [payload]);

  const orderedKpiKeys = useMemo(
    () => payload.team_table.columns.map((column) => column.kpi_key),
    [payload.team_table.columns]
  );

  const officeOptions = useMemo(() => {
    return Array.from(
      new Set(allRows.map((row) => row.office_label).filter(Boolean))
    ).sort() as string[];
  }, [allRows]);

  const affiliationOptions = useMemo(() => {
    return Array.from(
      new Set(allRows.map((row) => row.affiliation_type).filter(Boolean))
    ).sort() as string[];
  }, [allRows]);

  const contractorOptions = useMemo(() => {
    return Array.from(
      new Set(
        allRows
          .map((row) => row.contractor_name)
          .filter((value): value is string => Boolean(value))
      )
    ).sort();
  }, [allRows]);

  const supervisorOptions = useMemo<SupervisorOption[]>(() => {
    const byValue = new Map<string, string>();

    for (const row of allRows) {
      const value = String(row.reports_to_person_id ?? "").trim();
      if (!value) continue;

      const label = String(row.reports_to_label ?? "").trim() || value;
      if (!byValue.has(value)) byValue.set(value, label);
    }

    return [...byValue.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [allRows]);

  const showOffice = officeOptions.length > 1;
  const showAffiliation = affiliationOptions.length > 1;
  const showContractor = contractorOptions.length > 1;
  const showSupervisor = supervisorOptions.length > 1;

  const { showTeamScope } = useScopedTeamControls(allRows, controls);

  const scopedRows = useMemo(() => {
    return buildScopedRows(allRows, controls);
  }, [allRows, controls]);

  const { scopeLabel, headerModel } = useManagerHeaderScope({
    controls,
    scopedRows,
    header: payload.header,
  });

  const hasExecutiveSlice = useMemo(() => {
    return hasActiveExecutiveSlice(controls);
  }, [controls]);

  const executiveComparisonTitle = useMemo(() => {
    return buildExecutiveComparisonTitle(controls);
  }, [controls]);

  const executiveComparisonSubtitle = useMemo(() => {
    return buildExecutiveComparisonSubtitle(controls);
  }, [controls]);

  const baseExecutiveItems = useMemo(() => {
    return payload.executive_strip?.base?.items ?? [];
  }, [payload]);

  const scopedExecutiveItems = useMemo<MetricsScopedExecutiveKpiItem[]>(() => {
    if (!hasExecutiveSlice) return [];

    const runtime = payload.executive_strip?.runtime;
    if (!runtime) return payload.executive_strip?.scope?.items ?? [];

    const scopedTechIds = new Set(
      scopedRows
        .map((row) => String(row.tech_id ?? "").trim())
        .filter(Boolean)
    );

    const currentRows = runtime.current_rows.filter((row) =>
      scopedTechIds.has(row.tech_id)
    );
    const previousRows = runtime.previous_rows.filter((row) =>
      scopedTechIds.has(row.tech_id)
    );

    const rubricByKpi = buildRubricMap(runtime.rubric_rows);

    const scopedTrend = buildExecutiveKpis({
      definitions: runtime.definitions as any,
      supervisorScores: currentRows as any,
      orgScores: previousRows as any,
      rubricByKpi: rubricByKpi as any,
      support: null,
      comparison_scope_code: "SCOPE_TREND",
    });

    const scopedContrast = buildExecutiveKpis({
      definitions: runtime.definitions as any,
      supervisorScores: currentRows as any,
      orgScores: runtime.current_rows as any,
      rubricByKpi: rubricByKpi as any,
      support: null,
      comparison_scope_code: runtime.comparison_scope_code,
    });

    return scopedTrend.map((trendItem) => {
      const contrastItem = scopedContrast.find(
        (item) => item.kpi_key === trendItem.kpi_key
      );

      return {
        kpi_key: trendItem.kpi_key,
        label: trendItem.label,
        value_display: trendItem.value_display,
        band_key: trendItem.band_key,
        band_label: trendItem.band_label,
        support: trendItem.support ?? null,

        trend_scope_code: trendItem.comparison_scope_code,
        trend_comparison_value_display: trendItem.comparison_value_display,
        trend_variance_display: trendItem.variance_display,
        trend_state: trendItem.comparison_state,

        contrast_scope_code: runtime.comparison_scope_code,
        contrast_comparison_value_display:
          contrastItem?.comparison_value_display ?? "—",
        contrast_variance_display: contrastItem?.variance_display ?? null,
        contrast_state: contrastItem?.comparison_state ?? "neutral",
      };
    });
  }, [payload, scopedRows, hasExecutiveSlice]);

  const scopedRiskInsights = useMemo(() => {
    return buildScopedRiskInsights({
      source: payload.risk_insights,
      scopedRows,
    });
  }, [payload.risk_insights, scopedRows]);

  const scopedWorkMix = useMemo(
    () => buildScopedWorkMix(scopedRows),
    [scopedRows]
  );

  const workMixContent = scopedWorkMix ? (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-card px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total Jobs
          </div>
          <div className="mt-1 text-2xl font-semibold">{scopedWorkMix.total}</div>
        </div>

        <div className="rounded-xl border bg-card px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Installs
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {scopedWorkMix.installs}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatPercent(scopedWorkMix.install_pct)}
          </div>
        </div>

        <div className="rounded-xl border bg-card px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            TCs
          </div>
          <div className="mt-1 text-2xl font-semibold">{scopedWorkMix.tcs}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatPercent(scopedWorkMix.tc_pct)}
          </div>
        </div>

        <div className="rounded-xl border bg-card px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            SROs
          </div>
          <div className="mt-1 text-2xl font-semibold">{scopedWorkMix.sros}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatPercent(scopedWorkMix.sro_pct)}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="text-sm text-muted-foreground">No work mix available.</div>
  );

  function updateUrl(nextClass: ReportClassType, nextRange: MetricsRangeKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("class_type", nextClass);
    params.set("range", nextRange);
    router.push(`/company-manager/metrics?${params.toString()}`);
  }

  async function loadInspectionPayload(args: {
    row: any;
    column: { kpi_key: string; label: string };
    metric: any;
    range?: "FM" | "PREVIOUS" | "3FM" | "12FM";
  }): Promise<WorkforceInspectionPayload | null> {
    const personId = String(args.row?.person_id ?? "").trim();
    const techId = String(args.row?.tech_id ?? "").trim();
    const kpiKey = String(args.column?.kpi_key ?? "").trim();

    if (!personId || !techId || !kpiKey) return null;

    const params = new URLSearchParams();
    params.set("person_id", personId);
    params.set("tech_id", techId);
    params.set("kpi_key", kpiKey);
    params.set("full_name", String(args.row?.full_name ?? "Unknown"));
    params.set("context", buildInspectionContext(args.row));
    params.set("title", String(args.column?.label ?? kpiKey));
    params.set("value_display", String(args.metric?.value_display ?? ""));
    params.set("value", String(args.metric?.metric_value ?? ""));
    params.set("band_key", String(args.metric?.render_band_key ?? "NO_DATA"));
    params.set(
      "range",
      String(args.range ?? payload.filters.active_range ?? "FM")
    );
    params.set("class_type", currentClass);

    if (args.row?.contractor_name) {
      params.set("contractor_name", String(args.row.contractor_name));
    }

    const response = await fetch(`/api/metrics/inspection?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) return null;

    const json = await response.json();
    return json?.ok ? (json.payload as WorkforceInspectionPayload) : null;
  }

  return (
    <div className="space-y-4">
      <MetricsSmartHeader
        header={headerModel}
        scopeLabel={scopeLabel}
      />

      <MetricsControlsStrip
        classOptions={[
          { value: "NSR", label: "NSR" },
          { value: "SMART", label: "SMART" },
        ]}
        selectedClass={currentClass}
        onClassChange={(next) =>
          updateUrl(normalizeClassType(next), currentRange)
        }
        rangeOptions={payload.filters.available_ranges.map((rangeKey) => ({
          value: rangeKey,
          label: toRangeLabel(rangeKey),
        }))}
        selectedRange={currentRange}
        onRangeChange={(next) =>
          updateUrl(
            currentClass,
            normalizeRangeType(next, payload.filters.active_range)
          )
        }
        officeOptions={officeOptions}
        affiliationOptions={affiliationOptions}
        contractorOptions={contractorOptions}
        supervisorOptions={supervisorOptions}
        showOffice={showOffice}
        showAffiliation={showAffiliation}
        showContractor={showContractor}
        showSupervisor={showSupervisor}
        showTeamScope={showTeamScope}
        value={controls}
        onChange={setControls}
        onReset={() =>
          setControls({
            office_label: null,
            affiliation_type: null,
            contractor_name: null,
            reports_to_person_id: null,
            team_scope_mode: "ROLLUP",
          })
        }
      />

      {payload.permissions.can_view_exec_strip ? (
        <MetricsExecutiveKpiStrip
          items={baseExecutiveItems}
          comparisonItems={scopedExecutiveItems}
          comparisonTitle={executiveComparisonTitle}
          comparisonSubtitle={executiveComparisonSubtitle}
          subtitle="Current stable set compared against the previous metric batch."
        />
      ) : null}

      {payload.permissions.can_view_risk_strip ? (
        <MetricsRiskStrip
          items={payload.risk_strip ?? []}
          insights={scopedRiskInsights}
        />
      ) : null}

      {payload.permissions.can_view_team_table ? (
        <MetricsTeamPerformanceTableClient
          columns={payload.team_table.columns.map((column) => ({
            kpi_key: column.kpi_key,
            label: column.label,
            report_order: column.report_order,
          }))}
          rows={scopedRows}
          range={payload.filters.active_range}
          workMixTitle="Work Mix"
          workMixContent={workMixContent}
          loadInspectionPayload={loadInspectionPayload}
          renderInspectionDrawer={({
            open,
            onClose,
            row,
            column,
            metrics,
          }) => (
            <MetricsTechDrillDrawer
              open={open}
              onClose={onClose}
              name={String(row.full_name ?? row.tech_id ?? "Unknown Tech")}
              context={buildInspectionContext(row as any)}
              metrics={orderInspectionMetrics(metrics, orderedKpiKeys)}
              selectedKpi={column.kpi_key}
              loadPayload={async (kpiKey) => {
                return loadInspectionPayload({
                  row,
                  column: {
                    kpi_key: kpiKey,
                    label: column.label,
                  },
                  metric:
                    (row as any).metrics?.find((m: any) => m.metric_key === kpiKey) ??
                    null,
                  range: payload.filters.active_range,
                });
              }}
            />
          )}
        />
      ) : null}
    </div>
  );
}