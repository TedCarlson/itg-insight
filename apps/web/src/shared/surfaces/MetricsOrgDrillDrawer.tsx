// path: apps/web/src/shared/surfaces/MetricsOrgDrillDrawer.tsx

"use client";

import { useMemo } from "react";

import MetricInspectionDrawer from "@/shared/ui/workforce/MetricInspectionDrawer";
import MetricHeaderCard from "@/shared/ui/workforce/MetricHeaderCard";
import MetricTrendSection from "@/shared/ui/workforce/MetricTrendSection";
import MetricPeriodDetailTable from "@/shared/ui/workforce/MetricPeriodDetailTable";
import TnpsSentimentMix from "@/shared/ui/workforce/TnpsSentimentMix";

import type {
  InspectionDrawerModel,
  InspectionMetricCell,
  InspectionRenderModel,
  WorkforceInspectionPayload,
} from "@/shared/kpis/contracts/inspectionTypes";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

import type {
  MetricsExecutiveKpiItem,
  MetricsExecutiveStripRuntimePayload,
  MetricsScopedExecutiveKpiItem,
} from "@/shared/types/metrics/executiveStrip";

type Props = {
  open: boolean;
  onClose: () => void;
  kpiKey: string | null;
  baseItems: MetricsExecutiveKpiItem[];
  scopeItems?: MetricsScopedExecutiveKpiItem[] | null;
  runtime: MetricsExecutiveStripRuntimePayload;
  range?: MetricsRangeKey;
  pcOrgId?: string | null;
  scopeType?: "AFFILIATE" | "ORG";
};

function toInspectionMetric(item: MetricsExecutiveKpiItem): InspectionMetricCell {
  return {
    kpi_key: item.kpi_key,
    label: item.label,
    value: null,
    value_display: item.value_display,
    band_key: item.band_key as InspectionMetricCell["band_key"],
  };
}

export default function MetricsOrgDrillDrawer({
  open,
  onClose,
  kpiKey,
  baseItems,
  range = "FM",
  pcOrgId = null,
  scopeType = "AFFILIATE",
}: Props) {
  const metrics = useMemo(
    () => baseItems.map(toInspectionMetric),
    [baseItems]
  );

  async function loadPayload(
    nextKpiKey: string
  ): Promise<WorkforceInspectionPayload | null> {
    const params = new URLSearchParams();
    params.set("kpi_key", nextKpiKey);
    params.set("range", range);
    params.set("scope_type", scopeType);

    if (pcOrgId) {
      params.set("pc_org_id", pcOrgId);
    }

    const res = await fetch(`/api/metrics/org-inspection?${params.toString()}`);
    const json = await res.json();

    if (!res.ok || !json?.ok) return null;

    return json.data as WorkforceInspectionPayload | null;
  }

  function resolveModel(args: {
    metric: InspectionMetricCell;
    payload: WorkforceInspectionPayload | null;
  }): InspectionDrawerModel | null {
    const payload =
      args.payload ??
      ((args.metric as any)?.inspection_payload as
        | WorkforceInspectionPayload
        | null
        | undefined);

    if (!payload) return null;

    const renderModel = payload.render_model as InspectionRenderModel | null;
    if (!renderModel) return null;

    const header = (
      <MetricHeaderCard
        title={renderModel.header.title}
        valueDisplay={renderModel.header.valueDisplay}
        rangeLabel={renderModel.header.rangeLabel ?? null}
      />
    );

    const sentiment =
      renderModel.sentiment?.kind === "tnps_sentiment" ? (
        <TnpsSentimentMix
          totalSurveys={renderModel.sentiment.totalSurveys}
          totalPromoters={renderModel.sentiment.totalPromoters}
          totalDetractors={renderModel.sentiment.totalDetractors}
          title={renderModel.sentiment.title}
        />
      ) : null;

    const trend = (
      <MetricTrendSection
        title={renderModel.trend.title}
        subtitle={renderModel.trend.subtitle}
        badgeValue={renderModel.trend.badgeValue ?? null}
        points={renderModel.trend.points}
        currentValue={renderModel.trend.currentValue ?? null}
        updatesCount={renderModel.trend.updatesCount ?? null}
        monthsCount={renderModel.trend.monthsCount ?? null}
        rangeLabel={renderModel.trend.rangeLabel ?? null}
      />
    );

    const period =
      renderModel.periodDetail && renderModel.periodDetail.rows.length > 0 ? (
        <MetricPeriodDetailTable
          title={renderModel.periodDetail.title}
          columns={renderModel.periodDetail.columns}
          rows={renderModel.periodDetail.rows}
          footer={renderModel.periodDetail.footer ?? null}
        />
      ) : null;

    return {
      summaryRows: payload.summary_rows ?? [],
      chart: null,
      periodDetail: (
        <div className="flex flex-col gap-4">
          {header}
          {sentiment}
          {trend}
          {period}
        </div>
      ),
      extraSections: [],
    };
  }

  return (
    <MetricInspectionDrawer
      open={open}
      onClose={onClose}
      name="Organization"
      context="Org Rollup"
      metrics={metrics}
      initialSelectedKpi={kpiKey}
      loadPayload={loadPayload}
      buildModel={resolveModel}
    />
  );
}