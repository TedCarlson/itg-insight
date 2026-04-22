// path: apps/web/src/shared/surfaces/MetricsTechDrillDrawer.tsx

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
import type { ScorecardTile } from "@/shared/kpis/core/scorecardTypes";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  context?: string | null;
  metrics: InspectionMetricCell[];
  selectedKpi: string | null;
};

export default function MetricsTechDrillDrawer({
  open,
  onClose,
  name,
  context,
  metrics,
  selectedKpi,
}: Props) {
  const orderedMetrics = useMemo(() => metrics, [metrics]);

  function resolveModel(args: {
    metric: InspectionMetricCell;
    tile: ScorecardTile;
  }): InspectionDrawerModel | null {
    const payload = (args.metric as any)?.inspection_payload as
      | WorkforceInspectionPayload
      | null
      | undefined;

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

    let sentiment: React.ReactNode = null;
    if (renderModel.sentiment?.kind === "tnps_sentiment") {
      sentiment = (
        <TnpsSentimentMix
          totalSurveys={renderModel.sentiment.totalSurveys}
          totalPromoters={renderModel.sentiment.totalPromoters}
          totalDetractors={renderModel.sentiment.totalDetractors}
          title={renderModel.sentiment.title}
        />
      );
    }

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
      name={name}
      context={context}
      metrics={orderedMetrics}
      initialSelectedKpi={selectedKpi}
      buildModel={resolveModel}
    />
  );
}