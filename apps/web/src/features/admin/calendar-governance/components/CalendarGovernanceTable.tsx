import type { BlackoutCalendarDay } from "@/shared/server/calendar/types";

type Props = {
  days: BlackoutCalendarDay[];
};

function getEffectiveRule(day: BlackoutCalendarDay) {
  const operationalRule = day.rules.find(
    (rule) => rule.source === "blackout_rule",
  );

  return operationalRule ?? day.rules[0] ?? null;
}

function hasHolidayAnchor(day: BlackoutCalendarDay) {
  return day.rules.some((rule) => rule.source === "holiday_baseline");
}

export default function CalendarGovernanceTable({ days }: Props) {
  const effectiveRows = days
    .map((day) => ({
      day,
      rule: getEffectiveRule(day),
      hasHolidayAnchor: hasHolidayAnchor(day),
    }))
    .filter((row) => row.rule);

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold">
          Runtime blackout calendar
        </h2>

        <p className="mt-1 text-xs text-[var(--to-ink-muted)]">
          Effective blackout dates consumed by Booking, Schedule, Dispatch, and Route Lock.
        </p>
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-neutral-100">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Date</th>
            <th className="px-4 py-3 text-left font-semibold">Label</th>
            <th className="px-4 py-3 text-left font-semibold">Type</th>
            <th className="px-4 py-3 text-left font-semibold">
              Holiday Anchor
            </th>
            <th className="px-4 py-3 text-left font-semibold">
              Manager Controlled Intake
            </th>
          </tr>
        </thead>

        <tbody>
          {effectiveRows.map(({ day, rule, hasHolidayAnchor }) => (
            <tr key={day.date} className="border-t border-neutral-200">
              <td className="px-4 py-3">{day.date}</td>
              <td className="px-4 py-3">{rule?.label}</td>
              <td className="px-4 py-3">{rule?.blackoutType}</td>
              <td className="px-4 py-3">
                {hasHolidayAnchor ? "Yes" : "No"}
              </td>
              <td className="px-4 py-3">
                {rule?.managerControlledRequestEntry ? "Yes" : "No"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
