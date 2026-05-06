// path: apps/web/src/shared/components/metrics/RollupReportOverlay.tsx

"use client";

type TeamClass = "ITG" | "BP";
type ReportClass = "NSR" | "SMART";
type ReportRange = "FM" | "PREVIOUS" | "3FM" | "12FM";

type RollupKpi = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string;
  band_key: string | null;
  weighted_points?: number | null;
};

type SupervisorRollupRow = {
  supervisor_person_id: string;
  supervisor_name: string;
  team_class: TeamClass;
  rollup_hc: number;
  jobs: number;
  composite_score: number | null;
  rank: number | null;
  kpis: RollupKpi[];
};

export type RollupReportPayload = {
  header: {
    generated_at: string;
    class_type: ReportClass;
    range: ReportRange;
    org_display: string | null;
  };
  segments: {
    itg_supervisors: SupervisorRollupRow[];
    bp_companies: SupervisorRollupRow[];
    all_supervisors: SupervisorRollupRow[];
  };
};

type Props = {
  open: boolean;
  loading?: boolean;
  payload: RollupReportPayload | null;
  error?: string | null;
  onClose: () => void;
};

function formatComposite(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function shortKpiLabel(kpi: RollupKpi) {
  const map: Record<string, string> = {
    tnps_score: "tNPS",
    ftr_rate: "FTR",
    tool_usage_rate: "Tool",
    contact_48hr_rate: "48hr Contact",
    pure_pass_rate: "Pure Pass",
    soi_rate: "SOI",
    repeat_rate: "Repeat",
    rework_rate: "Rework",
    met_rate: "MET",
  };

  return map[kpi.kpi_key] ?? kpi.label;
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

function CompositeCell({ row }: { row: SupervisorRollupRow }) {
  return (
    <div className="text-center">
      <div className="text-[18px] font-semibold leading-none text-[var(--to-ink)]">
        {formatComposite(row.composite_score)}
      </div>
    </div>
  );
}

function MetricPill({ kpi }: { kpi: RollupKpi }) {
  return (
    <div
      className={[
        "relative inline-flex min-w-[72px] flex-col overflow-hidden rounded-xl border bg-white px-2 py-1.5 text-center shadow-[var(--to-shadow-xs)]",
        metricTone(kpi.band_key),
      ].join(" ")}
    >
      <div
        className={[
          "absolute left-0 top-0 h-[3px] w-full rounded-t-xl",
          metricAccent(kpi.band_key),
        ].join(" ")}
      />
      <div className="pt-0.5 text-[13px] font-medium leading-none text-[var(--to-ink)]">
        {kpi.value_display ?? "—"}
      </div>
      <div className="mt-0.5 text-[9px] leading-none text-[var(--to-ink-muted)]">
        {kpi.weighted_points != null
          ? `+${formatComposite(kpi.weighted_points)}`
          : "—"}
      </div>
    </div>
  );
}

function RollupTable({
  title,
  nameColumnLabel = "Supervisor",
  rows,
}: {
  title: string;
  nameColumnLabel?: string;
  rows: SupervisorRollupRow[];
}) {
  const safeRows = rows ?? [];
  const sampleKpis = safeRows[0]?.kpis ?? [];

  return (
    <section className="rounded-2xl border bg-background p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>

      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b text-[10px]">
              <th className="w-[70px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                Rank
              </th>
              <th className="w-[190px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                {nameColumnLabel}
              </th>
              <th className="w-[70px] px-3 py-2.5 text-center font-medium text-muted-foreground">
                HC
              </th>
              <th className="w-[80px] px-3 py-2.5 text-center font-medium text-muted-foreground">
                Jobs
              </th>
              <th className="w-[92px] px-3 py-2.5 text-center font-medium text-muted-foreground">
                Composite
              </th>

              {sampleKpis.map((kpi) => (
                <th
                  key={kpi.kpi_key}
                  className="px-2.5 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap"
                >
                  {shortKpiLabel(kpi)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {safeRows.length ? (
              safeRows.map((row) => (
                <tr
                  key={row.supervisor_person_id}
                  className="border-b last:border-b-0"
                >
                  <td className="px-3 py-3 text-left text-[var(--to-ink)]">
                    {row.rank != null ? `#${row.rank}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-left">
                    <div className="font-medium leading-tight text-[var(--to-ink)]">
                      {row.supervisor_name}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-[var(--to-ink)]">
                    {row.rollup_hc}
                  </td>
                  <td className="px-3 py-3 text-center text-[var(--to-ink)]">
                    {row.jobs}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CompositeCell row={row} />
                  </td>

                  {row.kpis.map((kpi) => (
                    <td key={kpi.kpi_key} className="px-2 py-2.5 text-center">
                      <MetricPill kpi={kpi} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-3 py-4 text-sm text-muted-foreground"
                  colSpan={5 + sampleKpis.length}
                >
                  No rows available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function RollupReportOverlay({
  open,
  loading,
  payload,
  error,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4">
      <div className="mx-auto flex max-h-[92vh] max-w-6xl flex-col rounded-2xl bg-card p-4 shadow-xl">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {payload?.header.org_display ?? "Rollup Report"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>

        {loading ? (
          <p className="shrink-0 text-sm text-muted-foreground">
            Loading report...
          </p>
        ) : null}

        {error ? (
          <p className="shrink-0 text-sm text-red-600">{error}</p>
        ) : null}

        {payload ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <RollupTable
              title="ITG Supervisors"
              nameColumnLabel="Supervisor"
              rows={payload.segments.itg_supervisors ?? []}
            />

            <RollupTable
              title="BP Companies"
              nameColumnLabel="Company"
              rows={payload.segments.bp_companies ?? []}
            />

            <RollupTable
              title="All Supervisors"
              nameColumnLabel="Supervisor"
              rows={payload.segments.all_supervisors ?? []}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}