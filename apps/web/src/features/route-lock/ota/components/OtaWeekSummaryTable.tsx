// path: apps/web/src/features/route-lock/ota/components/OtaWeekSummaryTable.tsx

import { Card } from "@/components/ui/Card";
import type { OtaPayload } from "../types";

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtDate(value: string) {
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}

export function OtaWeekSummaryTable({
  payload,
  busy,
  openWeek,
  onOpenWeek,
}: {
  payload: OtaPayload | null;
  busy: boolean;
  openWeek: string | null;
  onOpenWeek: (weekStart: string) => void;
}) {
  return (
    <Card>
      <div className="mb-3">
        <h3 className="font-semibold text-[var(--to-ink)]">
          {payload?.window.label ?? "OTA Window"}
        </h3>
        <p className="text-sm text-[var(--to-ink-muted)]">
          {payload ? `${payload.window.from} → ${payload.window.to}` : busy ? "Loading…" : "No data loaded"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--to-ink-muted)]">
              <th className="px-3 py-2">Week</th>
              <th className="px-3 py-2">First Jobs</th>
              <th className="px-3 py-2">Eligible</th>
              <th className="px-3 py-2">Late</th>
              <th className="px-3 py-2">Late Rate</th>
              <th className="px-3 py-2">Avg TTFJ</th>
              <th className="px-3 py-2">Worst</th>
              <th className="px-3 py-2">Signal</th>
            </tr>
          </thead>
          <tbody>
            {(payload?.weeks ?? []).map((week) => (
              <tr
                key={week.week_start}
                onClick={() => onOpenWeek(week.week_start)}
                className={cls(
                  "cursor-pointer rounded-2xl border",
                  openWeek === week.week_start && "outline outline-2 outline-blue-300",
                  week.status === "NEEDS_ATTENTION"
                    ? "bg-red-50/70"
                    : "bg-[var(--to-surface)]"
                )}
              >
                <td className="rounded-l-2xl px-3 py-3 font-semibold">
                  {fmtDate(week.week_start)} → {fmtDate(week.week_end)}
                </td>
                <td className="px-3 py-3">{week.first_jobs}</td>
                <td className="px-3 py-3">{week.eligible_count}</td>
                <td className="px-3 py-3">{week.late_count}</td>
                <td className="px-3 py-3">{week.late_rate}%</td>
                <td className="px-3 py-3">{week.avg_ttfj_display}</td>
                <td className="px-3 py-3">{week.worst_late_display}</td>
                <td className="rounded-r-2xl px-3 py-3">
                  {week.status === "NEEDS_ATTENTION"
                    ? "Review"
                    : week.status === "CLEAN"
                      ? "Clean"
                      : "No data"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
