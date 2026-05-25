"use client";

import { useState } from "react";

export default function CreateBlackoutRuleForm() {
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    try {
      setSaving(true);

      const response = await fetch(
        "/api/admin/calendar-governance",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            countryCode: "US",
            label,
            startDate,
            endDate,
            blackoutType: "holiday_weekend",
            managerControlledRequestEntry: true,
            active: true,
          }),
        },
      );

      if (!response.ok) {
        const details = await response.text();

        console.error(
          "calendar_governance_create_failed",
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

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Blackout label"
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
        />

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          {saving ? "Saving..." : "Create blackout"}
        </button>
      </div>
    </div>
  );
}
