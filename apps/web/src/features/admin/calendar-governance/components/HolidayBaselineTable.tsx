import type { HolidayBaselineItem } from "@/shared/server/calendar/types";

type Props = {
  holidays: HolidayBaselineItem[];
};

export default function HolidayBaselineTable({ holidays }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold">Trusted US holiday baseline</h2>
        <p className="mt-1 text-xs text-[var(--to-ink-muted)]">
          Read-only factual holiday source used to anchor blackout rules.
        </p>
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-neutral-100">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Date</th>
            <th className="px-4 py-3 text-left font-semibold">Holiday</th>
            <th className="px-4 py-3 text-left font-semibold">Source</th>
            <th className="px-4 py-3 text-left font-semibold">Source Key</th>
          </tr>
        </thead>

        <tbody>
          {holidays.map((holiday) => (
            <tr
              key={holiday.holidayId}
              className="border-t border-neutral-200"
            >
              <td className="px-4 py-3">{holiday.holidayDate}</td>
              <td className="px-4 py-3">{holiday.holidayName}</td>
              <td className="px-4 py-3">{holiday.source}</td>
              <td className="px-4 py-3">{holiday.sourceKey ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
