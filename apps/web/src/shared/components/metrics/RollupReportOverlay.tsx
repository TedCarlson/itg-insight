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
};

type SupervisorRollupRow = {
  supervisor_person_id: string;
  supervisor_name: string;
  team_class: TeamClass;
  rollup_hc: number;
  jobs: number;
  composite_score: number | null;
  rank: number;
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

function formatScore(value: number | null) {
  if (typeof value !== "number") return "—";
  return value.toFixed(2);
}

function shortKpiLabel(kpi: RollupKpi) {
  const map: Record<string, string> = {
    tnps_score: "tNPS",
    ftr_rate: "FTR",
    tool_usage_rate: "Tool",
  };

  return map[kpi.kpi_key] ?? kpi.label;
}

function bandTone(band: string | null) {
  if (band === "EXCEEDS") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (band === "MEETS") {
    return "border-sky-300 bg-sky-50 text-sky-800";
  }

  if (band === "NEEDS_IMPROVEMENT") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  if (band === "MISSES") {
    return "border-rose-300 bg-rose-50 text-rose-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-500";
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-2 text-left font-medium">Rank</th>
              <th className="px-2 py-2 text-left font-medium">
                {nameColumnLabel}
              </th>
              <th className="px-2 py-2 text-right font-medium">HC</th>
              <th className="px-2 py-2 text-right font-medium">Jobs</th>
              <th className="px-2 py-2 text-right font-medium">Comp</th>

              {sampleKpis.map((kpi) => (
                <th
                  key={kpi.kpi_key}
                  className="px-2 py-2 text-right font-medium"
                >
                  {shortKpiLabel(kpi)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {safeRows.length ? (
              safeRows.map((row) => (
                <tr key={row.supervisor_person_id} className="border-b">
                  <td className="px-2 py-2 text-left">#{row.rank}</td>
                  <td className="px-2 py-2 text-left">{row.supervisor_name}</td>
                  <td className="px-2 py-2 text-right">{row.rollup_hc}</td>
                  <td className="px-2 py-2 text-right">{row.jobs}</td>
                  <td className="px-2 py-2 text-right">
                    {formatScore(row.composite_score)}
                  </td>

                  {row.kpis.map((kpi) => (
                    <td key={kpi.kpi_key} className="px-2 py-2 text-right">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs ${bandTone(
                          kpi.band_key
                        )}`}
                      >
                        {kpi.value_display}
                      </span>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-2 py-4 text-sm text-muted-foreground"
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