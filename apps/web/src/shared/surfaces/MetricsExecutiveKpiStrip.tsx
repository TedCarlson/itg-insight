// path: apps/web/src/shared/surfaces/MetricsExecutiveKpiStrip.tsx

"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import MetricsOrgDrillDrawer from "@/shared/surfaces/MetricsOrgDrillDrawer";
import type {
  MetricsExecutiveKpiItem,
  MetricsExecutiveStripRuntimePayload,
  MetricsScopedExecutiveKpiItem,
} from "@/shared/types/metrics/executiveStrip";

type Props = {
  title?: string;
  subtitle?: string | null;

  items: MetricsExecutiveKpiItem[];

  comparisonItems?: MetricsScopedExecutiveKpiItem[];
  comparisonTitle?: string;
  comparisonSubtitle?: string | null;

  runtime?: MetricsExecutiveStripRuntimePayload | null;
};

function topBarClass(bandKey: string) {
  if (bandKey === "EXCEEDS") return "bg-[var(--to-success)]";
  if (bandKey === "MEETS") return "bg-[var(--to-primary)]";
  if (bandKey === "NEEDS_IMPROVEMENT") return "bg-[var(--to-warning)]";
  if (bandKey === "MISSES") return "bg-[var(--to-danger)]";
  return "bg-[var(--to-border)]";
}

function comparisonPillClass(state: "better" | "worse" | "neutral") {
  if (state === "better") {
    return "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]";
  }
  if (state === "worse") {
    return "border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_10%,white)]";
  }
  return "border-[var(--to-border)] bg-muted/10";
}

function BaseComparisonLine(item: MetricsExecutiveKpiItem) {
  return `${item.comparison_scope_code} ${item.comparison_value_display}`;
}

function ScopeTrendLine(item: MetricsScopedExecutiveKpiItem) {
  return `Prior ${item.trend_comparison_value_display}`;
}

function ScopeContrastLine(item: MetricsScopedExecutiveKpiItem) {
  return `${item.contrast_scope_code} ${item.contrast_comparison_value_display}`;
}

function BaseKpiCard({
  item,
  onClick,
}: {
  item: MetricsExecutiveKpiItem;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="overflow-hidden rounded-lg border bg-card text-left transition hover:-translate-y-[1px] hover:shadow-sm"
    >
      <div className={`h-1 w-full ${topBarClass(item.band_key)}`} />

      <div className="px-2 py-2">
        <div className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">
          {item.label}
        </div>

        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="text-[15px] font-semibold leading-none">
            {item.value_display ?? "—"}
          </div>

          <div className="whitespace-nowrap text-[9px] text-muted-foreground">
            {item.band_label}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="truncate text-[9px] text-muted-foreground">
            {BaseComparisonLine(item)}
          </div>

          <div
            className={[
              "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8px] font-medium",
              comparisonPillClass(item.comparison_state),
            ].join(" ")}
          >
            {item.variance_display ?? "—"}
          </div>
        </div>
      </div>
    </button>
  );
}

function ScopedKpiCard({
  item,
  onClick,
}: {
  item: MetricsScopedExecutiveKpiItem;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="overflow-hidden rounded-lg border bg-card text-left transition hover:-translate-y-[1px] hover:shadow-sm"
    >
      <div className={`h-1 w-full ${topBarClass(item.band_key)}`} />

      <div className="px-2 py-2">
        <div className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">
          {item.label}
        </div>

        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="text-[15px] font-semibold leading-none">
            {item.value_display ?? "—"}
          </div>

          <div className="whitespace-nowrap text-[9px] text-muted-foreground">
            {item.band_label}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="truncate text-[9px] text-muted-foreground">
            {ScopeTrendLine(item)}
          </div>

          <div
            className={[
              "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8px] font-medium",
              comparisonPillClass(item.trend_state),
            ].join(" ")}
          >
            {item.trend_variance_display ?? "—"}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="truncate text-[9px] text-muted-foreground">
            {ScopeContrastLine(item)}
          </div>

          <div
            className={[
              "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8px] font-medium",
              comparisonPillClass(item.contrast_state),
            ].join(" ")}
          >
            {item.contrast_variance_display ?? "—"}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function MetricsExecutiveKpiStrip({
  title = "Executive KPI Strip",
  subtitle,
  items,
  comparisonItems = [],
  comparisonTitle = "Scoped Comparison",
  comparisonSubtitle,
  runtime = null,
}: Props) {
  const [selectedKpiKey, setSelectedKpiKey] = useState<string | null>(null);
  const hasComparisonRow = comparisonItems.length > 0;
  const canOpenDrawer = !!runtime;

  return (
    <>
      <Card className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 text-[10px] text-muted-foreground">
                {subtitle}
              </div>
            ) : null}
          </div>

          <div className="text-[10px] text-muted-foreground">
            {items.length} KPIs
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-max grid-flow-col auto-cols-[160px] gap-2">
            {items.map((item) => (
              <BaseKpiCard
                key={item.kpi_key}
                item={item}
                onClick={
                  canOpenDrawer ? () => setSelectedKpiKey(item.kpi_key) : undefined
                }
              />
            ))}
          </div>
        </div>

        {hasComparisonRow ? (
          <div className="mt-3 border-t pt-3">
            <div className="mb-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {comparisonTitle}
              </div>
              {comparisonSubtitle ? (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {comparisonSubtitle}
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <div className="grid min-w-max grid-flow-col auto-cols-[160px] gap-2">
                {comparisonItems.map((item) => (
                  <ScopedKpiCard
                    key={item.kpi_key}
                    item={item}
                    onClick={
                      canOpenDrawer
                        ? () => setSelectedKpiKey(item.kpi_key)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {runtime ? (
        <MetricsOrgDrillDrawer
          open={!!selectedKpiKey}
          onClose={() => setSelectedKpiKey(null)}
          kpiKey={selectedKpiKey}
          baseItems={items}
          scopeItems={comparisonItems}
          runtime={runtime}
        />
      ) : null}
    </>
  );
}