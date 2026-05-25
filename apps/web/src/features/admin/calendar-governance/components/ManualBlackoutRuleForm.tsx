"use client";

import { useState } from "react";

export default function ManualBlackoutRuleForm() {
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [managerControlled, setManagerControlled] = useState(true);
  const [saving, setSaving] = useState(false);

  async function createRule() {
    try {
      setSaving(true);

      const response = await fetch("/api/admin/calendar-governance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryCode: "US",
          label,
          startDate,
          endDate,
          sourceHolidayId: null,
          blackoutType: "operational_blackout",
          managerControlledRequestEntry: managerControlled,
          active: true,
        }),
      });

      if (!response.ok) {
        const details = await response.text();

        console.error(
          "manual_blackout_rule_create_failed",
          response.status,
          details,
        );

        return;
      }

      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  const disabled =
    saving || !label.trim() || !startDate.trim() || !endDate.trim();

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold">
          Add non-holiday blackout range
        </h2>

        <p className="mt-1 text-xs text-[var(--to-ink-muted)]">
          Use this for operational blackout windows that are not tied to a fixed holiday.
        </p>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-[1.5fr_160px_160px_220px_120px]">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Blackout label"
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
        />

        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
        />

        <input
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
        />

        <label className="flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={managerControlled}
            onChange={(event) =>
              setManagerControlled(event.target.checked)
            }
          />
          Manager-controlled intake
        </label>

        <button
          type="button"
          onClick={createRule}
          disabled={disabled}
          className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving" : "Add"}
        </button>
      </div>
    </div>
  );
}
