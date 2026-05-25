"use client";

import { useState } from "react";

import type { CalendarGovernanceRow } from "@/shared/server/calendar/types";

type Props = {
  rows: CalendarGovernanceRow[];
};

export default function CalendarGovernanceEditor({ rows }: Props) {
  const [items, setItems] = useState(rows);
  const [savingHolidayId, setSavingHolidayId] =
    useState<string | null>(null);

  function updateRow(
    holidayId: string,
    patch: Partial<CalendarGovernanceRow>,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.holidayId === holidayId
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  }

  async function save(row: CalendarGovernanceRow) {
    try {
      setSavingHolidayId(row.holidayId);

      const response = await fetch(
        row.blackoutRuleId
          ? `/api/admin/calendar-governance/${row.blackoutRuleId}`
          : "/api/admin/calendar-governance",
        {
          method: row.blackoutRuleId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            countryCode: "US",
            label: `${row.holidayName} Coverage`,
            startDate: row.expandedStartDate,
            endDate: row.expandedEndDate,
            sourceHolidayId: row.holidayId,
            blackoutType: row.blackoutType,
            managerControlledRequestEntry:
              row.managerControlledRequestEntry,
            active: row.active,
          }),
        },
      );

      if (!response.ok) {
        const details = await response.text();

        console.error(
          "calendar_governance_save_failed",
          response.status,
          details,
        );

        return;
      }

      window.location.reload();
    } finally {
      setSavingHolidayId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold">
          Calendar blackout governance
        </h2>

        <p className="mt-1 text-xs text-[var(--to-ink-muted)]">
          Holiday dates are fixed. Edit only the added blackout coverage window.
        </p>
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-neutral-100">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">
              Holiday
            </th>
            <th className="px-4 py-3 text-left font-semibold">
              Fixed Date
            </th>
            <th className="px-4 py-3 text-left font-semibold">
              Coverage Start
            </th>
            <th className="px-4 py-3 text-left font-semibold">
              Coverage End
            </th>
            <th className="px-4 py-3 text-left font-semibold">
              Manager Intake
            </th>
            <th className="px-4 py-3 text-left font-semibold">
              Active
            </th>
            <th className="px-4 py-3 text-right font-semibold">
              Save
            </th>
          </tr>
        </thead>

        <tbody>
          {items.map((row) => (
            <tr
              key={row.holidayId}
              className="border-t border-neutral-200"
            >
              <td className="px-4 py-3">
                <div className="font-medium">{row.holidayName}</div>
                <div className="text-xs text-[var(--to-ink-muted)]">
                  {row.sourceKey ?? row.source}
                </div>
              </td>

              <td className="px-4 py-3">{row.holidayDate}</td>

              <td className="px-4 py-3">
                <input
                  type="date"
                  value={row.expandedStartDate}
                  onChange={(event) =>
                    updateRow(row.holidayId, {
                      expandedStartDate: event.target.value,
                    })
                  }
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </td>

              <td className="px-4 py-3">
                <input
                  type="date"
                  value={row.expandedEndDate}
                  onChange={(event) =>
                    updateRow(row.holidayId, {
                      expandedEndDate: event.target.value,
                    })
                  }
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                />
              </td>

              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={row.managerControlledRequestEntry}
                  onChange={(event) =>
                    updateRow(row.holidayId, {
                      managerControlledRequestEntry:
                        event.target.checked,
                    })
                  }
                />
              </td>

              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={row.active}
                  onChange={(event) =>
                    updateRow(row.holidayId, {
                      active: event.target.checked,
                    })
                  }
                />
              </td>

              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => save(row)}
                  disabled={savingHolidayId === row.holidayId}
                  className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingHolidayId === row.holidayId
                    ? "Saving"
                    : row.blackoutRuleId
                      ? "Update"
                      : "Create"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
