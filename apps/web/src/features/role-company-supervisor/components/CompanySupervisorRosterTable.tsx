"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import PopoverPanel from "@/components/ui/PopoverPanel";
import OverlayPanel from "@/components/ui/OverlayPanel";
import SurfaceHelpOverlay from "@/components/ui/SurfaceHelpOverlay";

import type {
  WorkforceMetricCell,
  WorkforceRubricRow,
} from "@/shared/kpis/engine/workforceTypes";
import type { WorkMixSummary } from "@/shared/kpis/engine/buildWorkMixSummary";
import type { ParityRow } from "@/shared/kpis/engine/buildParityRows";

import CompanySupervisorWorkMixCard from "./CompanySupervisorWorkMixCard";
import CompanySupervisorParityCard from "./CompanySupervisorParityCard";

type RankSeat = {
  rank: number;
  population: number;
};

type CompanySupervisorRosterRow = {
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
  rows: CompanySupervisorRosterRow[];
  rubricByKpi?: Map<string, WorkforceRubricRow[]>;
  work_mix: WorkMixSummary;
  parityRows: ParityRow[];
};

function signalBarClass(bandKey: string | null | undefined) {
  if (bandKey === "EXCEEDS") return "bg-[var(--to-success)]";
  if (bandKey === "MEETS") return "bg-[var(--to-primary)]";
  if (bandKey === "NEEDS_IMPROVEMENT") return "bg-[var(--to-warning)]";
  if (bandKey === "MISSES") return "bg-[var(--to-danger)]";
  return "bg-transparent";
}

function formatPct(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return "—";
  }
  return `${((100 * part) / total).toFixed(1)}%`;
}

function formatRubricValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function displayHeaderLabel(label: string) {
  if (label === "Tool Usage %") return "Tool Usage %";
  if (label === "Pure Pass %") return "Pure Pass %";
  if (label === "48hr Contact") return "48hr Contact";
  return label;
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

function MetricCell({ metric }: { metric?: WorkforceMetricCell }) {
  return (
    <div className="flex justify-center">
      <div className="relative flex h-8 min-w-[66px] items-center justify-center rounded-lg border bg-card px-2 text-[11px] font-medium text-foreground">
        <span
          className={[
            "absolute left-0 top-0 h-[3px] w-full rounded-t-lg",
            signalBarClass(metric?.band_key),
          ].join(" ")}
        />
        {metric?.value_display ?? "—"}
      </div>
    </div>
  );
}

function RubricPopover(props: {
  label: string;
  rubric: WorkforceRubricRow[];
  onClose: () => void;
}) {
  return (
    <PopoverPanel onClose={props.onClose} align="center" widthClass="w-56">
      <div className="mb-2 text-xs font-semibold">{props.label}</div>

      {props.rubric.map((row) => (
        <div
          key={row.band_key}
          className="flex items-center justify-between gap-3 py-1 text-[10px]"
        >
          <span>{row.band_key}</span>
          <span>
            {formatRubricValue(row.min_value)} –{" "}
            {formatRubricValue(row.max_value)}
          </span>
        </div>
      ))}
    </PopoverPanel>
  );
}

function WorkMixPopover(props: {
  row: CompanySupervisorRosterRow;
  onClose: () => void;
}) {
  const total = props.row.work_mix.total;

  return (
    <PopoverPanel onClose={props.onClose} align="right" widthClass="w-56">
      <div className="mb-2 text-xs font-semibold">Work Mix</div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span>Total Jobs</span>
          <span>{total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Installs</span>
          <span>
            {props.row.work_mix.installs} ·{" "}
            {formatPct(props.row.work_mix.installs, total)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>TCs</span>
          <span>
            {props.row.work_mix.tcs} · {formatPct(props.row.work_mix.tcs, total)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>SROs</span>
          <span>
            {props.row.work_mix.sros} ·{" "}
            {formatPct(props.row.work_mix.sros, total)}
          </span>
        </div>
      </div>
    </PopoverPanel>
  );
}

function HeaderCell(props: {
  column: RosterColumn;
  rubric?: WorkforceRubricRow[];
  activeKey: string | null;
  setActiveKey: (value: string | null) => void;
  sectionStart?: boolean;
}) {
  const isOpen = props.activeKey === props.column.kpi_key;

  return (
    <th
      className={[
        "relative px-3 py-3 text-center align-bottom text-[10px] font-medium text-[color-mix(in_oklab,var(--to-primary)_70%,black)]",
        props.sectionStart ? "border-l border-[var(--to-border)]" : "",
      ].join(" ")}
    >
      <HeaderTrigger
        compact
        label={displayHeaderLabel(props.column.label)}
        onClick={() =>
          props.setActiveKey(isOpen ? null : props.column.kpi_key)
        }
      />

      {isOpen && props.rubric && props.rubric.length > 0 ? (
        <RubricPopover
          label={props.column.label}
          rubric={props.rubric}
          onClose={() => props.setActiveKey(null)}
        />
      ) : null}
    </th>
  );
}

function regionPodiumClass(rank: number | null | undefined) {
  if (rank === 1) {
    return "border-[#d4af37] bg-[color-mix(in_oklab,#d4af37_16%,white)] text-[#8a6a00]";
  }
  if (rank === 2) {
    return "border-[#aeb7c2] bg-[color-mix(in_oklab,#aeb7c2_18%,white)] text-[#556270]";
  }
  if (rank === 3) {
    return "border-[#b87333] bg-[color-mix(in_oklab,#b87333_16%,white)] text-[#7a4a1d]";
  }
  return "border-[var(--to-border)] bg-transparent text-muted-foreground";
}

function IdentityBlock(props: { row: CompanySupervisorRosterRow }) {
  const region = props.row.rank_context?.region ?? null;
  const team = props.row.rank_context?.team ?? null;

  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-semibold leading-tight">
        {props.row.full_name}
      </div>

      <div className="flex items-center gap-3 text-[10px] leading-tight">
        <span
          className={[
            "inline-flex items-center rounded-md border px-1.5 py-[2px]",
            regionPodiumClass(region?.rank),
          ].join(" ")}
          title={
            region
              ? `Region rank ${region.rank} of ${region.population}`
              : "Region rank unavailable"
          }
        >
          Region {region ? `#${region.rank}/${region.population}` : "—"}
        </span>

        <span className="text-muted-foreground">
          Team {team ? `#${team.rank}/${team.population}` : "—"}
        </span>
      </div>
    </div>
  );
}

function JobsCell(props: {
  row: CompanySupervisorRosterRow;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <td className="relative border-l border-[var(--to-border)] px-2 py-2 align-middle">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={props.onToggle}
          className="flex h-8 min-w-[54px] items-center justify-center rounded-xl border border-[var(--to-border)] bg-card px-2.5 text-[11px] font-medium transition hover:bg-muted/20"
        >
          {props.row.work_mix.total}
        </button>
      </div>

      {props.isOpen ? (
        <WorkMixPopover row={props.row} onClose={props.onClose} />
      ) : null}
    </td>
  );
}

export default function CompanySupervisorRosterTable({
  columns,
  rows,
  rubricByKpi,
  work_mix,
  parityRows,
}: Props) {
  const [activeKpiKey, setActiveKpiKey] = useState<string | null>(null);
  const [activeWorkMixTechId, setActiveWorkMixTechId] = useState<string | null>(
    null
  );
  const [activePanel, setActivePanel] = useState<
    "work_mix" | "parity" | "help" | null
  >(null);

  const rubricMap = rubricByKpi ?? new Map<string, WorkforceRubricRow[]>();

  function closeAllOverlays() {
    setActiveKpiKey(null);
    setActiveWorkMixTechId(null);
    setActivePanel(null);
  }

  function toggleWorkMix(techId: string) {
    setActiveKpiKey(null);
    setActivePanel(null);
    setActiveWorkMixTechId((current) => (current === techId ? null : techId));
  }

  function togglePanel(panel: "work_mix" | "parity" | "help") {
    setActiveKpiKey(null);
    setActiveWorkMixTechId(null);
    setActivePanel((current) => (current === panel ? null : panel));
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
                  <HeaderCell
                    key={column.kpi_key}
                    column={column}
                    rubric={rubricMap.get(column.kpi_key)}
                    activeKey={activeKpiKey}
                    setActiveKey={(value) => {
                      setActiveWorkMixTechId(null);
                      setActivePanel(null);
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
                    <IdentityBlock row={row} />
                  </td>

                  {columns.map((column, index) => (
                    <td
                      key={column.kpi_key}
                      className={[
                        "px-2 py-3 align-middle",
                        index === 0 ? "border-l border-[var(--to-border)]" : "",
                        index === 3 ? "border-l border-[var(--to-border)]" : "",
                      ].join(" ")}
                    >
                      <MetricCell
                        metric={row.metrics.find(
                          (metric) => metric.kpi_key === column.kpi_key
                        )}
                      />
                    </td>
                  ))}

                  <JobsCell
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
          <CompanySupervisorWorkMixCard work_mix={work_mix} />
        </OverlayPanel>
      ) : null}

      {activePanel === "parity" ? (
        <OverlayPanel title="Parity" onClose={closeAllOverlays}>
          <CompanySupervisorParityCard rows={parityRows} />
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
          ]}
        />
      ) : null}
    </>
  );
}