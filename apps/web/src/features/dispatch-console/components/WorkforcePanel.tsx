"use client";

import { useMemo } from "react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextInput } from "@/components/ui/TextInput";

import type { DaySummary, EntryType, WorkforceRow, WorkforceTab } from "../lib/types";
import { labelForEvent, routeLabel, chipClassForEvent } from "../lib/labels";

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtSummaryChip(label: string) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[11px]"
      style={{ borderColor: "var(--to-border)", background: "var(--to-surface)" }}
    >
      {label}
    </span>
  );
}

function EventChip({ t }: { t: EntryType }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[11px]"
      style={{ borderColor: "var(--to-border)", ...chipClassForEvent(t) }}
    >
      {labelForEvent(t)}
    </span>
  );
}

export function WorkforcePanel(props: {
  panelH: string;
  shiftDate: string;

  workforceTab: WorkforceTab;
  setWorkforceTab: (v: WorkforceTab) => void;

  loadingWorkforce: boolean;
  loadingRollup: boolean;
  loadingNotScheduled: boolean;

  loadRefresh: () => void;

  nameQuery: string;
  setNameQuery: (v: string) => void;

  routeQuery: string;
  setRouteQuery: (v: string) => void;

  summary: DaySummary | null;

  displayedWorkforce: WorkforceRow[];
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignment_id: string) => void;

  chipsByAssignment: Map<string, EntryType[]>;
}) {
  const filtered = useMemo(() => {
    const qName = props.nameQuery.trim().toLowerCase();
    const qRoute = props.routeQuery.trim().toLowerCase();

    return props.displayedWorkforce.filter((r) => {
      if (qName) {
        const name = (r.full_name ?? "").toLowerCase();
        const tech = String(r.tech_id ?? "").toLowerCase();
        const co = (r.co_name ?? "").toLowerCase();
        if (!name.includes(qName) && !tech.includes(qName) && !co.includes(qName)) return false;
      }

      if (qRoute) {
        const routeName = (r.planned_route_name ?? "").toLowerCase();
        const routeId = String(r.planned_route_id ?? "").toLowerCase();
        const isUnassigned = !routeName.trim() && !routeId.trim();
        const routeDisplay = routeLabel(r).toLowerCase();

        if (qRoute === "unassigned" || qRoute === "none") {
          if (!isUnassigned) return false;
        } else {
          if (!routeName.includes(qRoute) && !routeId.includes(qRoute) && !routeDisplay.includes(qRoute)) return false;
        }
      }

      return true;
    });
  }, [props.displayedWorkforce, props.nameQuery, props.routeQuery]);

  const leftEmptyText =
    props.workforceTab === "SCHEDULED"
      ? "No scheduled techs match your filters."
      : "No roster techs are not scheduled today.";

  return (
    <Card className={cls("lg:col-span-6 flex flex-col", props.panelH)}>
      <div
        className="sticky top-0 z-10 border-b bg-[var(--to-surface)] p-4"
        style={{ borderColor: "var(--to-border)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Workforce</div>
            <div className="text-xs text-[var(--to-ink-muted)]">{props.shiftDate}</div>
          </div>

          <div
            className="flex items-center gap-2 rounded-full border bg-[var(--to-surface)] p-1"
            style={{ borderColor: "var(--to-border)" }}
          >
            <SegmentedControl<WorkforceTab>
              value={props.workforceTab}
              onChange={(v) => props.setWorkforceTab(v)}
              size="sm"
              options={[
                { value: "SCHEDULED", label: "Scheduled" },
                { value: "NOT_SCHEDULED", label: "Not scheduled" },
              ]}
            />
            <Button
              variant="secondary"
              className="h-8 px-3 text-sm"
              onClick={props.loadRefresh}
              disabled={props.loadingWorkforce || props.loadingRollup || props.loadingNotScheduled}
            >
              {props.loadingWorkforce || props.loadingRollup || props.loadingNotScheduled ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <TextInput
            value={props.nameQuery}
            onChange={(e) => props.setNameQuery(e.target.value)}
            placeholder="Search name / tech id…"
          />
          <TextInput
            value={props.routeQuery}
            onChange={(e) => props.setRouteQuery(e.target.value)}
            placeholder="Filter route… (name/id/unassigned)"
          />
        </div>

        {props.summary ? (
          <div className="mt-3 flex flex-nowrap gap-2 overflow-hidden">
            {fmtSummaryChip(`${props.summary.call_out_count} call outs`)}
            {fmtSummaryChip(`${props.summary.add_in_count} add ins`)}
            {fmtSummaryChip(`${props.summary.bp_low_count ?? 0} BP-low`)}
            {fmtSummaryChip(`${props.summary.incident_count} incidents`)}
            {fmtSummaryChip(`Quota ${props.summary.quota_routes_required} routes`)}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {filtered.length === 0 ? (
          <div className="text-sm text-[var(--to-ink-muted)]">{leftEmptyText}</div>
        ) : (
          <div className="grid gap-2">
            {filtered.map((r) => {
              const active = r.assignment_id === props.selectedAssignmentId;
              const chips = props.chipsByAssignment.get(r.assignment_id) ?? [];

              const left = `${r.full_name ?? ""} (${String(r.tech_id ?? "").trim()})`;
              const right = routeLabel(r);

              return (
                <button
                  key={r.assignment_id}
                  type="button"
                  onClick={() => props.onSelectAssignment(r.assignment_id)}
                  className={cls(
                    "w-full rounded-xl border px-3 py-2 text-left transition",
                    active ? "ring-2 ring-[var(--to-focus)] bg-[var(--to-row-hover)]" : "hover:bg-[var(--to-row-hover)]"
                  )}
                  style={{ borderColor: "var(--to-border)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 truncate text-sm font-medium">{left}</div>
                        <div className="min-w-0 max-w-[55%] truncate text-right text-xs text-[var(--to-ink-muted)]">
                          {right}
                        </div>
                      </div>
                    </div>

                    {chips.length ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {chips.map((t) => (
                          <EventChip key={t} t={t} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="sticky bottom-0 border-t bg-[var(--to-surface)] px-4 py-2"
        style={{ borderColor: "var(--to-border)" }}
      >
        <div className="text-[11px] text-[var(--to-ink-muted)]"> </div>
      </div>
    </Card>
  );
}