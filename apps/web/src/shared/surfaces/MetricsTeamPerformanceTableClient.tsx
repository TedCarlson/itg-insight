// path: apps/web/src/shared/surfaces/MetricsTeamPerformanceTableClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

import MetricsTeamPerformanceTable, {
  type MetricsHelpSection,
  type MetricsInspectionMetricCell,
  type MetricsInspectionPayload,
  type MetricsTeamColumn,
  type MetricsTeamRow,
} from "@/shared/surfaces/MetricsTeamPerformanceTable";

type MetricsRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

type RowWorkMix = {
  total: number;
  installs: number;
  tcs: number;
  sros: number;
};

type RowWithWorkMix = MetricsTeamRow & {
  work_mix?: RowWorkMix | null;
  office_label?: string | null;
  affiliation_type?: string | null;
  reports_to_person_id?: string | null;
  co_code?: string | null;
};

type Props = {
  title?: string;
  columns: MetricsTeamColumn[];
  rows: RowWithWorkMix[];
  range?: MetricsRangeKey;

  workMixTitle?: string;
  workMixContent?: React.ReactNode;

  parityTitle?: string;
  parityContent?: React.ReactNode;

  helpTitle?: string;
  helpSubtitle?: string;
  helpSections?: MetricsHelpSection[];

  loadInspectionPayload?: (args: {
    row: MetricsTeamRow;
    column: MetricsTeamColumn;
    metric: any;
    range?: MetricsRangeKey;
  }) => Promise<MetricsInspectionPayload | null>;

  renderInspectionDrawer?: (args: {
    open: boolean;
    onClose: () => void;
    row: MetricsTeamRow;
    column: MetricsTeamColumn;
    metric: any;
    metrics: MetricsInspectionMetricCell[];
    loadPayload?: () => Promise<MetricsInspectionPayload | null>;
  }) => React.ReactNode;
};

function formatPercent(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function RowWorkMixPopover(props: {
  row: RowWithWorkMix;
  onClose: () => void;
}) {
  const mix = props.row.work_mix ?? null;

  if (!mix || mix.total <= 0) {
    return (
      <div className="fixed inset-0 z-50" onClick={props.onClose}>
        <div
          className="absolute right-6 top-28 w-[320px] rounded-2xl border bg-white p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                {props.row.full_name ?? "Unknown"}
              </div>
              <div className="text-xs text-muted-foreground">
                {props.row.tech_id ?? "—"}
              </div>
            </div>

            <button
              type="button"
              onClick={props.onClose}
              className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
            >
              Close
            </button>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            No work mix available for this row.
          </div>
        </div>
      </div>
    );
  }

  const installPct = mix.total > 0 ? mix.installs / mix.total : null;
  const tcPct = mix.total > 0 ? mix.tcs / mix.total : null;
  const sroPct = mix.total > 0 ? mix.sros / mix.total : null;

  const rows = [
    {
      label: "Total Jobs",
      value: mix.total,
      pct: "100.0%",
    },
    {
      label: "Installs",
      value: mix.installs,
      pct: formatPercent(installPct),
    },
    {
      label: "TCs",
      value: mix.tcs,
      pct: formatPercent(tcPct),
    },
    {
      label: "SROs",
      value: mix.sros,
      pct: formatPercent(sroPct),
    },
  ];

  return (
    <div className="fixed inset-0 z-50" onClick={props.onClose}>
      <div
        className="absolute right-6 top-28 w-[340px] rounded-2xl border bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              {props.row.full_name ?? "Unknown"}
            </div>
            <div className="text-xs text-muted-foreground">
              {props.row.tech_id ?? "—"}
            </div>
          </div>

          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
          >
            Close
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div>Type</div>
            <div>Value</div>
            <div>% Mix</div>
          </div>

          <div className="divide-y">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-sm"
              >
                <div className="text-foreground">{row.label}</div>
                <div className="text-right font-medium">{row.value}</div>
                <div className="text-right text-muted-foreground">{row.pct}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MetricsTeamPerformanceTableClient({
  title,
  columns,
  rows,
  range,
  workMixTitle = "Work Mix",
  workMixContent,
  parityTitle,
  parityContent,
  helpTitle,
  helpSubtitle,
  helpSections,
  loadInspectionPayload,
  renderInspectionDrawer,
}: Props) {
  const [jobsRowKey, setJobsRowKey] = useState<string | null>(null);

  const activeJobsRow = useMemo(() => {
    if (!jobsRowKey) return null;
    return rows.find((row) => row.subject_key === jobsRowKey) ?? null;
  }, [jobsRowKey, rows]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setJobsRowKey(null);
      }
    }

    if (activeJobsRow) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [activeJobsRow]);

  return (
    <>
      <MetricsTeamPerformanceTable
        title={title}
        columns={columns}
        rows={rows}
        range={range}
        workMixTitle={workMixTitle}
        workMixContent={workMixContent}
        parityTitle={parityTitle}
        parityContent={parityContent}
        helpTitle={helpTitle}
        helpSubtitle={helpSubtitle}
        helpSections={helpSections}
        onOpenJobs={(row) => setJobsRowKey(row.subject_key)}
        loadInspectionPayload={loadInspectionPayload}
        renderInspectionDrawer={renderInspectionDrawer}
      />

      {activeJobsRow ? (
        <RowWorkMixPopover
          row={activeJobsRow}
          onClose={() => setJobsRowKey(null)}
        />
      ) : null}
    </>
  );
}