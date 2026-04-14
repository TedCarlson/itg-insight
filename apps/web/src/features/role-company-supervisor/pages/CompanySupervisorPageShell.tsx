// path: apps/web/src/features/role-company-supervisor/pages/CompanySupervisorPageShell.tsx

import Link from "next/link";

import MetricsSmartHeader from "@/shared/surfaces/MetricsSmartHeader";
import MetricsExecutiveKpiStrip from "@/shared/surfaces/MetricsExecutiveKpiStrip";
import MetricsRiskStrip from "@/shared/surfaces/MetricsRiskStrip";
import MetricsTeamPerformanceTableClient from "@/shared/surfaces/MetricsTeamPerformanceTableClient";

import { getCompanySupervisorSurfacePayload } from "../lib/getCompanySupervisorSurfacePayload.server";

type ReportClassType = "NSR" | "SMART";
type MetricsRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

type Props = {
  range?: string;
  class_type: ReportClassType;
};

function toProfileKey(classType: ReportClassType): "NSR" | "SMART" {
  return classType === "SMART" ? "SMART" : "NSR";
}

function normalizeRangeKey(value: string | undefined): MetricsRangeKey {
  const upper = String(value ?? "FM").trim().toUpperCase();
  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

function toRangeLabel(rangeKey: MetricsRangeKey): string {
  if (rangeKey === "FM") return "Current";
  if (rangeKey === "PREVIOUS") return "Previous";
  if (rangeKey === "3FM") return "Previous 3FM";
  return "Previous 12FM";
}

function buildHref(args: {
  class_type: ReportClassType;
  range: MetricsRangeKey;
}) {
  const params = new URLSearchParams();
  params.set("class_type", args.class_type);
  params.set("range", args.range);
  return `/company-supervisor?${params.toString()}`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function ClassSelector(props: {
  class_type: ReportClassType;
  range: MetricsRangeKey;
}) {
  const baseClass =
    "inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-medium transition";
  const activeClass =
    "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] text-foreground";
  const idleClass =
    "border-[var(--to-border)] bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground";

  return (
    <div className="flex items-center gap-2">
      <Link
        href={buildHref({ class_type: "NSR", range: props.range })}
        className={[
          baseClass,
          props.class_type === "NSR" ? activeClass : idleClass,
        ].join(" ")}
      >
        NSR
      </Link>

      <Link
        href={buildHref({ class_type: "SMART", range: props.range })}
        className={[
          baseClass,
          props.class_type === "SMART" ? activeClass : idleClass,
        ].join(" ")}
      >
        SMART
      </Link>
    </div>
  );
}

export default async function CompanySupervisorPageShell(props: Props) {
  const range = normalizeRangeKey(props.range);

  const payload = await getCompanySupervisorSurfacePayload({
    profile_key: toProfileKey(props.class_type),
    range,
  });

  const workMixContent = payload.overlays.work_mix ? (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-card px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total Jobs
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {payload.overlays.work_mix.total}
          </div>
        </div>

        <div className="rounded-xl border bg-card px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Installs
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {payload.overlays.work_mix.installs}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatPercent(payload.overlays.work_mix.install_pct)}
          </div>
        </div>

        <div className="rounded-xl border bg-card px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            TCs
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {payload.overlays.work_mix.tcs}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatPercent(payload.overlays.work_mix.tc_pct)}
          </div>
        </div>

        <div className="rounded-xl border bg-card px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            SROs
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {payload.overlays.work_mix.sros}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatPercent(payload.overlays.work_mix.sro_pct)}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="text-sm text-muted-foreground">No work mix available.</div>
  );

  return (
    <div className="space-y-4 p-4">
      <MetricsSmartHeader
        header={payload.header}
        rangeOptions={
          payload.permissions.can_filter_range
            ? payload.filters.available_ranges.map((rangeKey) => ({
              key: rangeKey,
              label: toRangeLabel(rangeKey),
              active: payload.filters.active_range === rangeKey,
              onClick: undefined,
            }))
            : []
        }
        rightActions={
          <ClassSelector
            class_type={props.class_type}
            range={payload.filters.active_range}
          />
        }
      />

      {payload.permissions.can_view_exec_strip ? (
        <MetricsExecutiveKpiStrip
          items={payload.executive_kpis}
          subtitle="Supervisor scope compared against total region fact set."
        />
      ) : null}

      {payload.permissions.can_view_risk_strip ? (
        <MetricsRiskStrip
          items={payload.risk_strip ?? []}
          insights={payload.risk_insights ?? null}
        />
      ) : null}

      {payload.permissions.can_view_team_table ? (
        <MetricsTeamPerformanceTableClient
          columns={payload.team_table.columns.map((column) => ({
            kpi_key: column.kpi_key,
            label: column.label,
            report_order: column.report_order,
          }))}
          rows={payload.team_table.rows.map((row, index) => ({
            subject_key:
              row.row_key ??
              row.tech_id?.trim() ??
              `${row.full_name?.trim() || "unknown"}-${row.rank ?? "na"}-${index}`,
            full_name: row.full_name,
            tech_id: row.tech_id,
            composite_score: row.composite_score,
            rank: row.rank,
            jobs_display: row.jobs_display ?? null,
            risk_count: row.risk_count ?? null,
            work_mix: row.work_mix ?? null,
            metrics: row.metrics.map((metric) => ({
              metric_key: metric.metric_key,
              label:
                payload.team_table.columns.find(
                  (column) => column.kpi_key === metric.metric_key
                )?.label ?? metric.metric_key,
              metric_value: metric.value,
              render_band_key: metric.band_key,
              weighted_points: metric.weighted_points,
            })),
          }))}
          workMixTitle="Work Mix"
          workMixContent={workMixContent}
        />
      ) : null}
    </div>
  );
}