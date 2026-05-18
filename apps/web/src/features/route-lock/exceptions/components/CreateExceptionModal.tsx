"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/state/org";

type DraftRow = {
  shift_date: string;
  exception_type: string;
  force_off: boolean;
  override_route_id: string | null;
  override_hours: string;
  override_units: string;
  notes: string;
};

type ImpactPreviewRow = {
  shift_date: string;
  exception_type: string;
  force_off: boolean;
  current_delta: number | null;
  projected_delta: number | null;
  impact_change: number | null;
  state: "SAFE" | "TIGHT" | "RISK";
};

const TYPE_OPTIONS = [
  "VACATION",
  "PERSONAL_DAY",
  "FMLA",
  "ADD_DAY",
  "COVERAGE_ADD",
] as const;

function deriveForceOff(type: string): boolean {
  switch (type) {
    case "VACATION":
    case "PERSONAL_DAY":
    case "FMLA":
      return true;
    case "ADD_DAY":
    case "COVERAGE_ADD":
      return false;
    default:
      return false;
  }
}

function toDateOnly(d: Date) {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function eachDayInclusive(start: string, end: string) {
  const rows: string[] = [];
  let cur = parseLocalDate(start);
  const last = parseLocalDate(end);

  while (cur <= last) {
    rows.push(toDateOnly(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return rows;
}

function weekdayLabel(dateOnly: string) {
  return parseLocalDate(dateOnly).toLocaleDateString(undefined, { weekday: "short" });
}

function formatDelta(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function formatDeltaTransition(current: number | null, projected: number | null) {
  if (current === null || projected === null) return "—";
  return `${formatDelta(current)} → ${formatDelta(projected)}`;
}

function impactTone(state: ImpactPreviewRow["state"] | null | undefined) {
  if (state === "SAFE") {
    return "border-[rgba(37,99,235,0.35)] bg-[rgba(37,99,235,0.10)] text-[rgb(29,78,216)]";
  }
  if (state === "RISK") {
    return "border-[rgba(220,38,38,0.35)] bg-[rgba(220,38,38,0.10)] text-[rgb(185,28,28)]";
  }
  return "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.10)] text-[rgb(180,83,9)]";
}

export default function CreateExceptionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { selectedOrgId } = useOrg();

  const [techId, setTechId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>("VACATION");
  const [notes, setNotes] = useState("");
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [impactRows, setImpactRows] = useState<Record<string, ImpactPreviewRow>>({});
  const [impactBusy, setImpactBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canBuild = techId.trim() && startDate && endDate && startDate <= endDate;
  const canSubmit = !!selectedOrgId && techId.trim() && draftRows.length > 0 && !busy;

  useEffect(() => {
    if (!canBuild) {
      setDraftRows([]);
      return;
    }

    const next = eachDayInclusive(startDate, endDate).map((shift_date) => ({
      shift_date,
      exception_type: type,
      force_off: deriveForceOff(type),
      override_route_id: null,
      override_hours: "",
      override_units: "",
      notes,
    }));

    setDraftRows(next);
  }, [canBuild, startDate, endDate, type, notes]);

  useEffect(() => {
    if (!selectedOrgId || !draftRows.length) {
      setImpactRows({});
      setImpactBusy(false);
      return;
    }

    const controller = new AbortController();

    async function loadImpactPreview() {
      setImpactBusy(true);

      try {
        const res = await fetch("/api/route-lock/exceptions/impact-preview", {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pc_org_id: selectedOrgId,
            rows: draftRows.map((row) => ({
              shift_date: row.shift_date,
              exception_type: row.exception_type,
              force_off: row.force_off,
            })),
          }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          throw new Error(String(json?.error ?? "Failed to load impact preview"));
        }

        const nextMap: Record<string, ImpactPreviewRow> = {};

        for (const row of Array.isArray(json?.rows) ? json.rows : []) {
          const key = `${String(row?.shift_date ?? "")}__${String(row?.exception_type ?? "")}__${
            row?.force_off ? "1" : "0"
          }`;

          nextMap[key] = {
            shift_date: String(row?.shift_date ?? ""),
            exception_type: String(row?.exception_type ?? ""),
            force_off: !!row?.force_off,
            current_delta: row?.current_delta == null ? null : Number(row.current_delta),
            projected_delta: row?.projected_delta == null ? null : Number(row.projected_delta),
            impact_change: row?.impact_change == null ? null : Number(row.impact_change),
            state: row?.state === "SAFE" || row?.state === "RISK" ? row.state : "TIGHT",
          };
        }

        setImpactRows(nextMap);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setImpactRows({});
        setError(String(err?.message ?? "Failed to load impact preview"));
      } finally {
        if (!controller.signal.aborted) {
          setImpactBusy(false);
        }
      }
    }

    loadImpactPreview();
    return () => controller.abort();
  }, [selectedOrgId, draftRows]);

  const summary = useMemo(() => {
    if (!draftRows.length) return null;
    return `${draftRows.length} day${draftRows.length === 1 ? "" : "s"} drafted`;
  }, [draftRows]);

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setDraftRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function removeRow(index: number) {
    setDraftRows((prev) => prev.filter((_, i) => i !== index));
  }

  function getImpact(row: DraftRow) {
    const key = `${row.shift_date}__${row.exception_type}__${row.force_off ? "1" : "0"}`;
    return impactRows[key] ?? null;
  }

  async function submit() {
    if (!selectedOrgId || !canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/route-lock/exceptions/create-batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pc_org_id: selectedOrgId,
          tech_id: techId.trim(),
          rows: draftRows.map((row) => ({
            shift_date: row.shift_date,
            exception_type: row.exception_type,
            force_off: row.force_off,
            override_route_id: row.override_route_id || null,
            override_hours: row.override_hours === "" ? null : Number(row.override_hours),
            override_units: row.override_units === "" ? null : Number(row.override_units),
            notes: row.notes.trim() || null,
          })),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(String(json?.error ?? "Failed to create exceptions"));
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(String(err?.message ?? "Failed to create exceptions"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-[var(--to-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--to-border)] px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-[var(--to-ink)]">Draft Exceptions</div>
            <div className="text-sm text-[var(--to-ink-muted)]">
              Pick a date range, review the generated daily draft, then submit.
            </div>
          </div>

          <button
            type="button"
            className="rounded-lg border border-[var(--to-border)] px-3 py-1.5 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[var(--to-ink-muted)]">
                Tech ID
              </label>
              <input
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
                placeholder="e.g. 7003"
                className="h-9 rounded-lg border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[var(--to-ink-muted)]">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-lg border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[var(--to-ink-muted)]">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-lg border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[var(--to-ink-muted)]">
                Default Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as (typeof TYPE_OPTIONS)[number])}
                className="h-9 rounded-lg border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 text-sm"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[var(--to-ink-muted)]">
                Draft Notes
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Applied to every drafted day initially"
                className="h-9 rounded-lg border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 text-sm"
              />
            </div>

            <div className="flex items-end">
              <div className="rounded-lg border border-[var(--to-border)] bg-[var(--to-surface-2)] px-3 py-2 text-sm text-[var(--to-ink-muted)]">
                {summary ?? "Build a range to preview draft days"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-[var(--to-surface-2)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--to-ink)]">Draft Preview</div>
              <div className="text-xs text-[var(--to-ink-muted)]">
                {impactBusy ? "Refreshing projected Δ..." : "Projected Δ shown after approval"}
              </div>
            </div>

            {!canBuild ? (
              <div className="text-sm text-[var(--to-ink-muted)]">
                Enter tech, start date, and end date to generate the draft.
              </div>
            ) : draftRows.length ? (
              <div className="overflow-x-auto rounded-xl border border-[var(--to-border)] bg-[var(--to-surface)]">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-[var(--to-surface-2)]">
                    <tr>
                      <th className="border-b border-[var(--to-border)] px-3 py-2 text-left">Date</th>
                      <th className="border-b border-[var(--to-border)] px-3 py-2 text-left">Day</th>
                      <th className="border-b border-[var(--to-border)] px-3 py-2 text-left">Type</th>
                      <th className="border-b border-[var(--to-border)] px-3 py-2 text-left">Schedule Δ+/-</th>
                      <th className="border-b border-[var(--to-border)] px-3 py-2 text-left">Impact</th>
                      <th className="border-b border-[var(--to-border)] px-3 py-2 text-left">Notes</th>
                      <th className="border-b border-[var(--to-border)] px-3 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftRows.map((row, index) => {
                      const impact = getImpact(row);

                      return (
                        <tr key={row.shift_date}>
                          <td className="border-b border-[var(--to-border)] px-3 py-2">
                            {row.shift_date}
                          </td>
                          <td className="border-b border-[var(--to-border)] px-3 py-2 text-[var(--to-ink-muted)]">
                            {weekdayLabel(row.shift_date)}
                          </td>
                          <td className="border-b border-[var(--to-border)] px-3 py-2">
                            <select
                              value={row.exception_type}
                              onChange={(e) => {
                                const nextType = e.target.value;
                                updateRow(index, {
                                  exception_type: nextType,
                                  force_off: deriveForceOff(nextType),
                                });
                              }}
                              className="h-8 rounded-md border border-[var(--to-border)] bg-[var(--to-surface-2)] px-2 text-sm"
                            >
                              {TYPE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border-b border-[var(--to-border)] px-3 py-2 font-semibold tabular-nums">
                            {impactBusy && !impact ? (
                              <span className="text-[var(--to-ink-muted)]">…</span>
                            ) : (
                              formatDeltaTransition(
                                impact?.current_delta ?? null,
                                impact?.projected_delta ?? null
                              )
                            )}
                          </td>
                          <td className="border-b border-[var(--to-border)] px-3 py-2">
                            {impact ? (
                              <span
                                className={`inline-flex min-w-[62px] justify-center rounded-full border px-2 py-1 text-[11px] font-semibold ${impactTone(
                                  impact.state
                                )}`}
                              >
                                {impact.state}
                              </span>
                            ) : (
                              <span className="text-[var(--to-ink-muted)]">—</span>
                            )}
                          </td>
                          <td className="border-b border-[var(--to-border)] px-3 py-2">
                            <input
                              value={row.notes}
                              onChange={(e) => updateRow(index, { notes: e.target.value })}
                              placeholder="-"
                              className="h-8 min-w-[220px] rounded-md border border-[var(--to-border)] bg-[var(--to-surface-2)] px-2 text-sm"
                            />
                          </td>
                          <td className="border-b border-[var(--to-border)] px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeRow(index)}
                              className="rounded-md border border-[var(--to-border)] px-2 py-1 text-xs"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          {error ? <div className="text-sm text-[var(--to-danger,#b91c1c)]">{error}</div> : null}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-[var(--to-border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--to-border)] px-3 py-1.5 text-sm"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="rounded-lg bg-[rgba(29,78,216,0.92)] px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Submitting..." : "Submit Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}