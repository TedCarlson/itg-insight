// path: apps/web/src/shared/surfaces/MetricsTeamPerformanceTable.tsx

"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import OverlayPanel from "@/components/ui/OverlayPanel";
import SurfaceHelpOverlay from "@/components/ui/SurfaceHelpOverlay";

type MetricsRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

export type MetricsTeamColumn = {
  kpi_key: string;
  label: string;
  report_order?: number | null;
};

export type MetricsTeamCell = {
  metric_key: string;
  label?: string | null;
  metric_value: number | null;
  value_display?: string | null;
  render_band_key?: string | null;
  weighted_points?: number | null;
};

export type MetricsTeamRow = {
  subject_key: string;

  full_name?: string | null;
  tech_id?: string | null;

  composite_score?: number | null;
  rank?: number | null;

  risk_count?: number | null;
  jobs_display?: string | null;

  metrics: MetricsTeamCell[];
};

export type MetricsInspectionMetricCell = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string | null;
  band_key: string;
};

export type MetricsInspectionPayload = Record<string, unknown>;

export type MetricsHelpSection = {
  title: string;
  body: string;
};

type SelectedMetricTarget = {
  row: MetricsTeamRow;
  column: MetricsTeamColumn;
  metric: MetricsTeamCell;
};

type SortKey = "rank" | "composite" | "name";

type Props = {
  title?: string;
  columns: MetricsTeamColumn[];
  rows: MetricsTeamRow[];

  range?: MetricsRangeKey;

  workMixTitle?: string;
  workMixContent?: React.ReactNode;

  parityTitle?: string;
  parityContent?: React.ReactNode;

  helpTitle?: string;
  helpSubtitle?: string;
  helpSections?: MetricsHelpSection[];

  onOpenJobs?: (row: MetricsTeamRow) => void;

  loadInspectionPayload?: (args: {
    row: MetricsTeamRow;
    column: MetricsTeamColumn;
    metric: MetricsTeamCell;
    range?: MetricsRangeKey;
  }) => Promise<MetricsInspectionPayload | null>;

  renderInspectionDrawer?: (args: {
    open: boolean;
    onClose: () => void;
    row: MetricsTeamRow;
    column: MetricsTeamColumn;
    metric: MetricsTeamCell;
    metrics: MetricsInspectionMetricCell[];
    loadPayload?: () => Promise<MetricsInspectionPayload | null>;
  }) => React.ReactNode;
};

/* -------------------------------- helpers -------------------------------- */

function formatComposite(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function formatMetricValue(metricKey: string, value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (metricKey === "tnps_score") return value.toFixed(2);
  return value.toFixed(1);
}

function resolveMetricDisplayValue(metric: MetricsTeamCell) {
  if (typeof metric.value_display === "string" && metric.value_display.trim()) {
    return metric.value_display;
  }
  return formatMetricValue(metric.metric_key, metric.metric_value);
}

function resolveMetricBandKey(metric: MetricsTeamCell) {
  const band = metric.render_band_key;
  if (band === "EXCEEDS") return "EXCEEDS";
  if (band === "MEETS") return "MEETS";
  if (band === "NEEDS_IMPROVEMENT") return "NEEDS_IMPROVEMENT";
  if (band === "MISSES") return "MISSES";
  return "NO_DATA";
}

function toInspectionMetricCell(metric: MetricsTeamCell): MetricsInspectionMetricCell {
  return {
    kpi_key: metric.metric_key,
    label: metric.label ?? metric.metric_key,
    value: metric.metric_value ?? null,
    value_display: resolveMetricDisplayValue(metric),
    band_key: resolveMetricBandKey(metric),
  };
}

function metricTone(renderBandKey?: string | null) {
  switch (renderBandKey) {
    case "EXCEEDS":
      return "border-[color-mix(in_oklab,var(--to-success)_35%,white)]";
    case "MEETS":
      return "border-[color-mix(in_oklab,var(--to-warning)_35%,white)]";
    case "NEEDS_IMPROVEMENT":
      return "border-[color-mix(in_oklab,var(--to-warning)_55%,white)]";
    case "MISSES":
      return "border-[color-mix(in_oklab,var(--to-danger)_45%,white)]";
    default:
      return "border-[var(--to-border)]";
  }
}

function metricAccent(renderBandKey?: string | null) {
  switch (renderBandKey) {
    case "EXCEEDS":
      return "bg-[var(--to-success)]";
    case "MEETS":
      return "bg-[color-mix(in_oklab,var(--to-success)_65%,var(--to-warning))]";
    case "NEEDS_IMPROVEMENT":
      return "bg-[var(--to-warning)]";
    case "MISSES":
      return "bg-[var(--to-danger)]";
    default:
      return "bg-[var(--to-border)]";
  }
}

function sortRows(rows: MetricsTeamRow[], sortKey: SortKey) {
  const copy = [...rows];

  copy.sort((a, b) => {
    switch (sortKey) {
      case "rank":
        return (a.rank ?? 9999) - (b.rank ?? 9999);
      case "composite":
        return (b.composite_score ?? -1) - (a.composite_score ?? -1);
      case "name":
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      default:
        return 0;
    }
  });

  return copy;
}

function metricMap(row: MetricsTeamRow) {
  return new Map(row.metrics.map((m) => [m.metric_key, m]));
}

function displayFirstName(fullName?: string | null) {
  const trimmed = String(fullName ?? "").trim();
  if (!trimmed) return "Unknown";

  const first = trimmed.split(/\s+/)[0]?.trim();
  return first || "Unknown";
}

/* -------------------------------- UI -------------------------------- */

function HeaderTrigger(props: {
  label: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "inline-flex items-center text-[10px] font-medium text-[var(--to-primary)] transition hover:text-[color-mix(in_oklab,var(--to-primary)_75%,black)]",
        props.compact ? "" : "uppercase tracking-wide",
      ].join(" ")}
    >
      {props.label}
    </button>
  );
}

function MetricPill({
  metric,
  metricKey,
  onClick,
}: {
  metric?: MetricsTeamCell;
  metricKey: string;
  onClick?: () => void;
}) {
  const band = metric?.render_band_key ?? "NO_DATA";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        "relative min-w-[72px] rounded-xl border bg-white px-2 py-1.5 text-center shadow-[var(--to-shadow-xs)]",
        metricTone(band),
        onClick ? "transition hover:-translate-y-[1px]" : "cursor-default",
      ].join(" ")}
    >
      <div
        className={[
          "absolute left-0 top-0 h-[3px] w-full rounded-t-xl",
          metricAccent(band),
        ].join(" ")}
      />
      <div className="pt-0.5 text-[13px] font-medium leading-none text-[var(--to-ink)]">
        {resolveMetricDisplayValue(
          metric ?? { metric_key: metricKey, metric_value: null }
        )}
      </div>
      <div className="mt-0.5 text-[9px] leading-none text-[var(--to-ink-muted)]">
        {metric?.weighted_points != null
          ? `+${formatComposite(metric.weighted_points)}`
          : "—"}
      </div>
    </button>
  );
}

/* -------------------------------- main -------------------------------- */

export default function MetricsTeamPerformanceTable({
  title = "Team Performance",
  columns,
  rows,

  range,

  workMixTitle = "Work Mix",
  workMixContent,

  parityTitle = "Parity",
  parityContent,

  helpTitle = "How to Use Team Performance",
  helpSubtitle = "This table is built to support fast scan today and richer drilldown as the surface matures.",
  helpSections = [],

  onOpenJobs,

  loadInspectionPayload,
  renderInspectionDrawer,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [activePanel, setActivePanel] = useState<"work_mix" | "parity" | "help" | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<SelectedMetricTarget | null>(null);

  const sortedRows = useMemo(() => sortRows(rows, sortKey), [rows, sortKey]);

  const activeDrillMetrics = useMemo<MetricsInspectionMetricCell[]>(() => {
    if (!selectedMetric) return [];
    return selectedMetric.row.metrics.map(toInspectionMetricCell);
  }, [selectedMetric]);

  function closeAllOverlays() {
    setActivePanel(null);
    setSelectedMetric(null);
  }

  function openMetricInspection(
    row: MetricsTeamRow,
    column: MetricsTeamColumn,
    metric: MetricsTeamCell
  ) {
    setActivePanel(null);
    setSelectedMetric({ row, column, metric });
  }

  return (
    <>
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between rounded-2xl border bg-[color-mix(in_oklab,var(--to-primary)_8%,white)] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide">
              {title}
            </div>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-8 rounded-lg border px-2 text-[11px]"
            >
              <option value="rank">Sort: Rank</option>
              <option value="composite">Sort: Composite</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            {helpSections.length > 0 ? (
              <HeaderTrigger
                label="How to Use"
                onClick={() => setActivePanel("help")}
              />
            ) : null}

            {parityContent ? (
              <HeaderTrigger
                label={parityTitle}
                onClick={() => setActivePanel("parity")}
              />
            ) : null}

            <div className="text-xs text-[var(--to-ink-muted)]">
              {sortedRows.length} rows
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b text-[10px]">
                <th className="w-[190px] px-3 py-2.5 text-left">Tech</th>
                <th className="w-[92px] px-3 py-2.5 text-center">Composite</th>

                {columns.map((col) => (
                  <th
                    key={col.kpi_key}
                    className="px-2.5 py-2.5 text-center whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}

                <th className="w-[80px] px-2.5 py-2.5 text-center">
                  {workMixContent ? (
                    <HeaderTrigger
                      compact
                      label="Jobs"
                      onClick={() => setActivePanel("work_mix")}
                    />
                  ) : (
                    "Jobs"
                  )}
                </th>

                <th className="w-[60px] px-2.5 py-2.5 text-center">Risk</th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row) => {
                const map = metricMap(row);

                return (
                  <tr key={row.subject_key} className="border-b last:border-b-0">
                    <td className="px-2.5 py-2.5">
                      <div className="font-medium leading-tight text-[var(--to-ink)]">
                        {displayFirstName(row.full_name)}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-none text-[var(--to-ink-muted)]">
                        {row.tech_id ?? "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <div className="text-[18px] font-semibold leading-none text-[var(--to-ink)]">
                        {formatComposite(row.composite_score)}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-none text-[var(--to-ink-muted)]">
                        Rank {row.rank ?? "—"}
                      </div>
                    </td>

                    {columns.map((col) => {
                      const metric = map.get(col.kpi_key);

                      return (
                        <td
                          key={`${row.subject_key}-${col.kpi_key}`}
                          className="px-2 py-2.5 text-center"
                        >
                          <MetricPill
                            metric={metric}
                            metricKey={col.kpi_key}
                            onClick={
                              metric
                                ? () => openMetricInspection(row, col, metric)
                                : undefined
                            }
                          />
                        </td>
                      );
                    })}

                    <td className="px-2.5 py-3 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => onOpenJobs?.(row)}
                        disabled={!onOpenJobs}
                        className={[
                          "min-w-[52px] rounded-full border px-2 py-1 text-[11px] font-medium",
                          onOpenJobs
                            ? "transition hover:bg-muted/30"
                            : "cursor-default",
                        ].join(" ")}
                      >
                        {row.jobs_display ?? "—"}
                      </button>
                    </td>

                    <td className="px-2.5 py-3 text-center align-middle text-sm font-medium">
                      {row.risk_count ?? "—"}
                    </td>
                  </tr>
                );
              })}

              {sortedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(columns.length + 4, 5)}
                    className="px-4 py-8 text-center text-sm text-[var(--to-ink-muted)]"
                  >
                    No rows available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {activePanel === "work_mix" && workMixContent ? (
        <OverlayPanel title={workMixTitle} onClose={closeAllOverlays}>
          {workMixContent}
        </OverlayPanel>
      ) : null}

      {activePanel === "parity" && parityContent ? (
        <OverlayPanel title={parityTitle} onClose={closeAllOverlays}>
          {parityContent}
        </OverlayPanel>
      ) : null}

      {activePanel === "help" && helpSections.length > 0 ? (
        <SurfaceHelpOverlay
          title={helpTitle}
          subtitle={helpSubtitle}
          onClose={closeAllOverlays}
          sections={helpSections}
        />
      ) : null}

      {selectedMetric && renderInspectionDrawer
        ? renderInspectionDrawer({
            open: !!selectedMetric,
            onClose: () => setSelectedMetric(null),
            row: selectedMetric.row,
            column: selectedMetric.column,
            metric: selectedMetric.metric,
            metrics: activeDrillMetrics,
            loadPayload: loadInspectionPayload
              ? () =>
                  loadInspectionPayload({
                    row: selectedMetric.row,
                    column: selectedMetric.column,
                    metric: selectedMetric.metric,
                    range,
                  })
              : undefined,
          })
        : null}
    </>
  );
}