"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import OverlayPanel from "@/components/ui/OverlayPanel";
import SurfaceHelpOverlay from "@/components/ui/SurfaceHelpOverlay";

import type {
  WorkforceMetricCell,
  WorkforceRubricRow,
} from "@/shared/kpis/engine/workforceTypes";
import type { WorkMixSummary } from "@/shared/kpis/engine/buildWorkMixSummary";
import type { ParityRow } from "@/shared/kpis/engine/buildParityRows";

import type {
  InspectionMetricCell,
  WorkforceInspectionPayload,
} from "@/shared/kpis/contracts/inspectionTypes";
import type { KpiBandKey, MetricsRangeKey } from "@/shared/kpis/core/types";

import CompanyManagerWorkMixCard from "./CompanyManagerWorkMixCard";
import CompanyManagerParityCard from "./CompanyManagerParityCard";
import CompanyManagerTechDrillDrawer from "./CompanyManagerTechDrillDrawer";

import WorkforceHeaderCell from "@/shared/ui/workforce/table/WorkforceHeaderCell";
import WorkforceIdentityCell from "@/shared/ui/workforce/table/WorkforceIdentityCell";
import WorkforceMetricButtonCell from "@/shared/ui/workforce/table/WorkforceMetricButtonCell";
import WorkforceJobsCell from "@/shared/ui/workforce/table/WorkforceJobsCell";

type RankSeat = {
  rank: number;
  population: number;
};

type CompanyManagerRosterRow = {
  person_id: string;
  tech_id: string;
  full_name: string;
  contractor_name?: string | null;
  team_class: string;
  rank_context?: {
    team: RankSeat | null;
    region: RankSeat | null;
    division?: RankSeat | null;
  } | null;
  metrics: WorkforceMetricCell[];
  below_target_count: number;
  work_mix: {
    installs: number;
    tcs: number;
    sros: number;
    total: number;
  };
};

type RosterColumn = {
  kpi_key: string;
  label: string;
};

type Props = {
  columns: RosterColumn[];
  rows: CompanyManagerRosterRow[];
  rubricByKpi?: Map<string, WorkforceRubricRow[]>;
  work_mix: WorkMixSummary;
  parityRows: ParityRow[];
  active_range?: MetricsRangeKey;
};

type SelectedMetricTarget = {
  row: CompanyManagerRosterRow;
  column: RosterColumn;
  metric: WorkforceMetricCell;
};

function formatRankSeat(label: string, seat: RankSeat | null | undefined) {
  return seat ? `${label} #${seat.rank}/${seat.population}` : `${label} —`;
}

function resolveMetricNumericValue(metric: WorkforceMetricCell): number | null {
  const candidate =
    (metric as { value?: unknown }).value ??
    (metric as { value_numeric?: unknown }).value_numeric ??
    (metric as { raw_value?: unknown }).raw_value ??
    null;

  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function resolveMetricDisplayValue(metric: WorkforceMetricCell): string | null {
  const display = (metric as { value_display?: unknown }).value_display;
  return typeof display === "string" && display.trim() ? display : null;
}

function resolveMetricBandKey(metric: WorkforceMetricCell): KpiBandKey {
  const band = (metric as { band_key?: unknown }).band_key;

  if (band === "EXCEEDS") return "EXCEEDS";
  if (band === "MEETS") return "MEETS";
  if (band === "NEEDS_IMPROVEMENT") return "NEEDS_IMPROVEMENT";
  if (band === "MISSES") return "MISSES";
  return "NO_DATA";
}

function toInspectionMetricCell(metric: WorkforceMetricCell): InspectionMetricCell {
  return {
    kpi_key: metric.kpi_key,
    label: metric.label,
    value: resolveMetricNumericValue(metric),
    value_display: resolveMetricDisplayValue(metric),
    band_key: resolveMetricBandKey(metric),
  };
}

function HeaderTrigger(props: {
  label: string;
  onClick?: () => void;
  compact?: boolean;
  align?: "left" | "center" | "right";
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "inline-flex items-center text-[10px] font-medium text-[var(--to-primary)] transition hover:text-[color-mix(in_oklab,var(--to-primary)_75%,black)]",
        props.compact ? "" : "uppercase tracking-wide",
        props.align === "right" ? "justify-end" : "",
      ].join(" ")}
    >
      {props.label}
    </button>
  );
}

export default function CompanyManagerRosterTable({
  columns,
  rows,
  rubricByKpi,
  work_mix,
  parityRows,
  active_range,
}: Props) {
  const [activeKpiKey, setActiveKpiKey] = useState<string | null>(null);
  const [activeWorkMixTechId, setActiveWorkMixTechId] = useState<string | null>(
    null
  );
  const [activePanel, setActivePanel] = useState<
    "work_mix" | "parity" | "help" | null
  >(null);
  const [selectedMetric, setSelectedMetric] =
    useState<SelectedMetricTarget | null>(null);

  const rubricMap = rubricByKpi ?? new Map<string, WorkforceRubricRow[]>();
  const resolvedRange = active_range ?? ("FM" as MetricsRangeKey);

  function closeAllOverlays() {
    setActiveKpiKey(null);
    setActiveWorkMixTechId(null);
    setActivePanel(null);
    setSelectedMetric(null);
  }

  function toggleWorkMix(techId: string) {
    setActiveKpiKey(null);
    setActivePanel(null);
    setSelectedMetric(null);
    setActiveWorkMixTechId((current) => (current === techId ? null : techId));
  }

  function togglePanel(panel: "work_mix" | "parity" | "help") {
    setActiveKpiKey(null);
    setActiveWorkMixTechId(null);
    setSelectedMetric(null);
    setActivePanel((current) => (current === panel ? null : panel));
  }

  function openMetricInspection(
    row: CompanyManagerRosterRow,
    column: RosterColumn,
    metric: WorkforceMetricCell
  ) {
    setActiveKpiKey(null);
    setActiveWorkMixTechId(null);
    setActivePanel(null);
    setSelectedMetric({ row, column, metric });
  }

  const activeDrillMetrics = useMemo<InspectionMetricCell[]>(() => {
    if (!selectedMetric) return [];
    return selectedMetric.row.metrics.map(toInspectionMetricCell);
  }, [selectedMetric]);

  async function loadInspectionPayload(
    kpiKey: string
  ): Promise<WorkforceInspectionPayload | null> {
    if (!selectedMetric) return null;

    const row = selectedMetric.row;
    const metric =
      row.metrics.find((entry) => entry.kpi_key === kpiKey) ?? selectedMetric.metric;
    const column =
      columns.find((entry) => entry.kpi_key === kpiKey) ?? selectedMetric.column;

    const params = new URLSearchParams({
      person_id: row.person_id,
      tech_id: row.tech_id,
      full_name: row.full_name,
      context: row.team_class,
      kpi_key: column.kpi_key,
      title: column.label,
      value_display: resolveMetricDisplayValue(metric) ?? "",
      band_key: resolveMetricBandKey(metric),
      range: resolvedRange,
    });

    const numericValue = resolveMetricNumericValue(metric);
    if (numericValue != null) {
      params.set("value", String(numericValue));
    }

    if (row.contractor_name) {
      params.set("contractor_name", row.contractor_name);
    }

    const res = await fetch(`/api/metrics/inspection?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as
      | { ok: true; payload: WorkforceInspectionPayload }
      | { ok: false; error?: string }
      | null;

    if (!res.ok || !json || !json.ok) return null;

    return json.payload;
  }

  return (
    <>
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between rounded-2xl border bg-[color-mix(in_oklab,var(--to-primary)_8%,white)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
            Team Performance
          </div>

          <div className="flex items-center gap-4">
            <HeaderTrigger
              label="How to Use"
              onClick={() => togglePanel("help")}
            />
            <HeaderTrigger
              label="Parity"
              onClick={() => togglePanel("parity")}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b bg-[color-mix(in_oklab,var(--to-primary)_4%,white)]">
                <th className="w-[300px] px-4 py-4 text-left text-[11px] font-medium text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
                  Tech
                </th>

                {columns.map((column, index) => (
                  <WorkforceHeaderCell
                    key={column.kpi_key}
                    column={column}
                    rubric={rubricMap.get(column.kpi_key)}
                    activeKey={activeKpiKey}
                    setActiveKey={(value) => {
                      setActiveWorkMixTechId(null);
                      setActivePanel(null);
                      setSelectedMetric(null);
                      setActiveKpiKey(value);
                    }}
                    sectionStart={index === 0}
                  />
                ))}

                <th className="border-l border-[var(--to-border)] px-3 py-4 text-center text-[11px] font-medium text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
                  <HeaderTrigger
                    compact
                    label="Jobs"
                    onClick={() => togglePanel("work_mix")}
                  />
                </th>

                <th className="w-[56px] border-l border-[var(--to-border)] px-3 py-4 text-center text-[11px] font-medium text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
                  Risk
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.tech_id}
                  className={[
                    "border-b last:border-b-0",
                    index > 0 && index % 4 === 0
                      ? "border-t-2 border-t-[var(--to-border)]"
                      : "",
                  ].join(" ")}
                >
                  <td className="w-[300px] px-4 py-4 align-middle">
                    <WorkforceIdentityCell row={row} />
                  </td>

                  {columns.map((column, index) => {
                    const metric = row.metrics.find(
                      (entry) => entry.kpi_key === column.kpi_key
                    );

                    return (
                      <td
                        key={column.kpi_key}
                        className={[
                          "px-2 py-3 align-middle",
                          index === 0 ? "border-l border-[var(--to-border)]" : "",
                          index === 3 ? "border-l border-[var(--to-border)]" : "",
                        ].join(" ")}
                      >
                        <WorkforceMetricButtonCell
                          metric={metric}
                          onClick={
                            metric
                              ? () => openMetricInspection(row, column, metric)
                              : undefined
                          }
                        />
                      </td>
                    );
                  })}

                  <WorkforceJobsCell
                    row={row}
                    isOpen={activeWorkMixTechId === row.tech_id}
                    onToggle={() => toggleWorkMix(row.tech_id)}
                    onClose={closeAllOverlays}
                  />

                  <td className="border-l border-[var(--to-border)] px-3 py-4 text-center text-sm font-medium align-middle">
                    {row.below_target_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {activePanel === "work_mix" ? (
        <OverlayPanel title="Work Mix" onClose={closeAllOverlays}>
          <CompanyManagerWorkMixCard work_mix={work_mix} />
        </OverlayPanel>
      ) : null}

      {activePanel === "parity" ? (
        <OverlayPanel title="Parity" onClose={closeAllOverlays}>
          <CompanyManagerParityCard rows={parityRows} />
        </OverlayPanel>
      ) : null}

      {activePanel === "help" ? (
        <SurfaceHelpOverlay
          title="How to Use Team Performance"
          subtitle="This table is built to support fast scan today and richer drilldown as the surface matures."
          onClose={closeAllOverlays}
          sections={[
            {
              title: "Scan",
              body:
                "Read left to right by tech. KPI color carries the signal first, value second. Segment breaks separate primary KPIs, additional KPIs, and operational columns.",
            },
            {
              title: "Rank",
              body:
                "The leading badge shows region rank. Team and region rank context sit under the tech identity block for fast comparison without cluttering the KPI field.",
            },
            {
              title: "Rubric",
              body:
                "Select any KPI header to open its rubric. That lets you verify the band thresholds currently driving the paint and spot changes as standards evolve.",
            },
            {
              title: "Work Mix",
              body:
                "Select any Jobs value to see type counts and percentages for that tech. Select the Jobs header to open the broader work mix overlay for the scoped population.",
            },
            {
              title: "Parity",
              body:
                "Select Parity to compare contractor and company grouping performance using the same signal language as the main table.",
            },
            {
              title: "Drilldown",
              body:
                "Select any KPI value in the table to open the tech inspection drawer for that metric. This shared drawer foundation is now the standing path for deeper metric inspection.",
            },
          ]}
        />
      ) : null}

      {selectedMetric ? (
        <CompanyManagerTechDrillDrawer
          open={!!selectedMetric}
          onClose={() => setSelectedMetric(null)}
          name={selectedMetric.row.full_name}
          context={selectedMetric.row.team_class}
          metrics={activeDrillMetrics}
          selectedKpi={selectedMetric.column.kpi_key}
          loadPayload={loadInspectionPayload}
        />
      ) : null}
    </>
  );
}