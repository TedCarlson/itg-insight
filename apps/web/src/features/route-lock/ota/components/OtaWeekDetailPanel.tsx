// path: apps/web/src/features/route-lock/ota/components/OtaWeekDetailPanel.tsx

import { Card } from "@/components/ui/Card";
import type { OtaDayGroup, OtaDetailRow } from "../types";

export type OtaDetailFilter = "all" | "late" | "on_time" | "ineligible";

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtDate(value: string) {
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}

function compactTime(value: string | null) {
  if (!value) return "—";
  return value.slice(0, 5);
}

function OtaPill({ row }: { row: OtaDetailRow }) {
  if (row.status === "LATE") {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        TTFJ {row.ttfj_display}
      </span>
    );
  }

  if (row.status === "INELIGIBLE") {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
        Excluded
      </span>
    );
  }

  if (row.status === "UNKNOWN") {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
        Unknown
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      On time
    </span>
  );
}

export function OtaWeekDetailPanel({
  dayGroups,
  filter,
  onFilterChange,
}: {
  dayGroups: OtaDayGroup[];
  filter: OtaDetailFilter;
  onFilterChange: (filter: OtaDetailFilter) => void;
}) {
  return (
    <Card>
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-semibold text-[var(--to-ink)]">TTFJ Detail by Day</h3>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Day-first segmentation. Rows are sorted worst failure to cleanest inside each day.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["late", "Late"],
            ["on_time", "On Time"],
            ["ineligible", "Excluded"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onFilterChange(value as OtaDetailFilter)}
              className={cls(
                "rounded-xl border px-3 py-2 text-sm font-semibold",
                filter === value
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-[var(--to-border)] bg-[var(--to-surface)] text-[var(--to-ink)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {dayGroups.map((group) => (
          <div key={group.shift_date} className="overflow-hidden rounded-2xl border border-[var(--to-border)]">
            <div
              className={cls(
                "flex flex-col gap-1 border-b px-3 py-3 md:flex-row md:items-center md:justify-between",
                group.status === "NEEDS_ATTENTION" ? "bg-red-50/70" : "bg-[var(--to-surface-soft)]"
              )}
            >
              <div className="font-semibold text-[var(--to-ink)]">
                {group.weekday_label} {fmtDate(group.shift_date)}
              </div>
              <div className="text-sm text-[var(--to-ink-muted)]">
                {group.first_jobs} first jobs · {group.eligible_count} eligible · {group.late_count} late · worst {group.worst_late_display}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-[var(--to-ink-muted)]">
                    <th className="px-3 py-2">Tech</th>
                    <th className="px-3 py-2">Affiliation</th>
                    <th className="px-3 py-2">Frame</th>
                    <th className="px-3 py-2">Actual</th>
                    <th className="px-3 py-2">TTFJ</th>
                    <th className="px-3 py-2">Late</th>
                    <th className="px-3 py-2">Signal</th>
                    <th className="px-3 py-2">Job Type</th>
                    <th className="px-3 py-2">Job</th>
                    <th className="px-3 py-2">Timeframe Class</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr
                      key={`${row.shift_date}-${row.tech_id}`}
                      className={cls(
                        "border-b border-[var(--to-border)]",
                        row.status === "LATE" && "bg-red-50/60"
                      )}
                    >
                      <td className="px-3 py-2 font-semibold">
                        {row.full_name}
                        <div className="text-xs font-normal text-[var(--to-ink-muted)]">
                          {row.tech_id}
                        </div>
                      </td>
                      <td className="px-3 py-2">{row.affiliation ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.time_frame ?? "—"}
                        {row.time_frame_minutes == null ? null : (
                          <div className="text-xs text-[var(--to-ink-muted)]">
                            {row.time_frame_minutes}m
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">{compactTime(row.actual_start_time)}</td>
                      <td className="px-3 py-2 font-semibold">{row.ttfj_display}</td>
                      <td className="px-3 py-2">{row.late_display}</td>
                      <td className="px-3 py-2">
                        <OtaPill row={row} />
                      </td>
                      <td className="px-3 py-2">{row.job_type ?? "—"}</td>
                      <td className="px-3 py-2">{row.job_num || row.work_order_number || "—"}</td>
                      <td className="px-3 py-2 text-xs text-[var(--to-ink-muted)]">
                        {row.exclusion_reason ?? "Standard"}
                      </td>
                    </tr>
                  ))}

                  {group.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-sm text-[var(--to-ink-muted)]">
                        No rows match this filter for the day.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {dayGroups.length === 0 ? (
          <div className="rounded-2xl border border-[var(--to-border)] px-3 py-6 text-center text-sm text-[var(--to-ink-muted)]">
            No rows match the current detail filter.
          </div>
        ) : null}
      </div>
    </Card>
  );
}
