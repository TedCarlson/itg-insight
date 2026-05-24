"use client";

import { useMemo } from "react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";

import type {
  DaySummary,
  DispatchRouteOption,
  EntryType,
  EventType,
  LogRow,
  WorkforceRow,
  WorkforceTab,
} from "../lib/types";
import { labelForEvent, routeLabel, chipClassForEvent } from "../lib/labels";
import { DispatchInlineRowDrawer } from "./DispatchInlineRowDrawer";

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function SummaryChip(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-full border px-2 py-0.5 text-[11px] transition hover:bg-[var(--to-row-hover)]"
      style={{
        borderColor: props.active ? "var(--to-focus)" : "var(--to-border)",
        background: props.active ? "var(--to-row-hover)" : "var(--to-surface)",
      }}
    >
      {props.label}
    </button>
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

function SectionLabel({ title, count }: { title: string; count: number }) {
  return (
    <div className="sticky top-0 z-[1] bg-[var(--to-surface)] py-2">
      <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: "var(--to-border)" }}>
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--to-ink-muted)]">{title}</div>
        <div className="text-xs text-[var(--to-ink-muted)]">{count}</div>
      </div>
    </div>
  );
}

function WorkforceRowButton(props: {
  row: WorkforceRow;
  active: boolean;
  chips: EntryType[];
  onClick: () => void;
}) {
  const left = `${props.row.full_name ?? ""} (${String(props.row.tech_id ?? "").trim()})`;
  const right = routeLabel(props.row);

  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cls(
        "w-full rounded-xl border px-3 py-2 text-left transition",
        props.active ? "ring-2 ring-[var(--to-focus)] bg-[var(--to-row-hover)]" : "hover:bg-[var(--to-row-hover)]",
      )}
      style={{ borderColor: "var(--to-border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 truncate text-sm font-medium">{left}</div>
            <div className="min-w-0 max-w-[55%] truncate text-right text-xs text-[var(--to-ink-muted)]">{right}</div>
          </div>
        </div>

        {props.chips.length ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {props.chips.map((t) => (
              <EventChip key={t} t={t} />
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function WorkforcePanel(props: {
  panelH: string;
  shiftDate: string;

  loadingWorkforce: boolean;
  loadingRollup: boolean;
  loadingNotScheduled: boolean;

  loadRefresh: () => void;

  nameQuery: string;
  setNameQuery: (v: string) => void;

  routeQuery: string;
  setRouteQuery: (v: string) => void;

  summary: DaySummary | null;
  logFilter: EventType;
  setLogFilter: (v: EventType) => void;

  scheduledRows: WorkforceRow[];
  notScheduledRows: WorkforceRow[];

  selectedAssignmentId: string | null;
  onSelectAssignment: (assignment_id: string) => void;

  chipsByAssignment: Map<string, EntryType[]>;

  workforceTabForSelectedRow: WorkforceTab;
  selectedTech: WorkforceRow | null;

  routeOptions: DispatchRouteOption[];

  entryType: EntryType | null;
  setEntryType: (v: EntryType) => void;

  message: string;
  setMessage: (v: string) => void;

  techMoveFromRouteId: string;
  techMoveFromRouteName: string;

  techMoveToRouteId: string;
  techMoveToRouteName: string;

  setTechMoveDestination: (routeId: string, routeName: string) => void;

  editing: boolean;
  canSubmit: boolean;

  onSubmit: () => void;
  onClearOrCancel: () => void;

  logRows: LogRow[];
  loadingLog: boolean;
  onRefreshSelectedHistory: () => void;

  userId: string | null;
  onBeginEdit: (row: LogRow) => void;
  onDeleteNote: (row: LogRow) => void;
}) {
  const qName = props.nameQuery.trim().toLowerCase();
  const qRoute = props.routeQuery.trim().toLowerCase();

  const techMoveCount = useMemo(() => {
    let count = 0;
    for (const chips of props.chipsByAssignment.values()) {
      if (chips.includes("TECH_MOVE")) count += 1;
    }
    return count;
  }, [props.chipsByAssignment]);

  const matchesFilters = (r: WorkforceRow) => {
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
      } else if (!routeName.includes(qRoute) && !routeId.includes(qRoute) && !routeDisplay.includes(qRoute)) {
        return false;
      }
    }

    if (props.logFilter !== "ALL") {
      const chips = props.chipsByAssignment.get(r.assignment_id) ?? [];
      if (!chips.includes(props.logFilter as EntryType)) return false;
    }

    return true;
  };

  const scheduledFiltered = props.scheduledRows.filter(matchesFilters);
  const notScheduledFiltered = props.notScheduledRows.filter(matchesFilters);

  const renderRows = (rows: WorkforceRow[], workforceTab: WorkforceTab) =>
    rows.map((r) => {
      const active = r.assignment_id === props.selectedAssignmentId;
      const chips = props.chipsByAssignment.get(r.assignment_id) ?? [];

      return (
        <div key={r.assignment_id} className="grid gap-2">
          <WorkforceRowButton
            row={r}
            active={active}
            chips={chips}
            onClick={() => props.onSelectAssignment(r.assignment_id)}
          />

          {active && props.selectedTech ? (
            <DispatchInlineRowDrawer
              workforceTab={workforceTab}
              tech={props.selectedTech}
              routeOptions={props.routeOptions}
              entryType={props.entryType}
              setEntryType={props.setEntryType}
              message={props.message}
              setMessage={props.setMessage}
              techMoveFromRouteId={props.techMoveFromRouteId}
              techMoveFromRouteName={props.techMoveFromRouteName}
              techMoveToRouteId={props.techMoveToRouteId}
              techMoveToRouteName={props.techMoveToRouteName}
              setTechMoveDestination={props.setTechMoveDestination}
              editing={props.editing}
              canSubmit={props.canSubmit}
              onSubmit={props.onSubmit}
              onClearOrCancel={props.onClearOrCancel}
              logRows={props.logRows}
              loadingLog={props.loadingLog}
              onRefresh={props.onRefreshSelectedHistory}
              userId={props.userId}
              onBeginEdit={props.onBeginEdit}
              onDeleteNote={props.onDeleteNote}
            />
          ) : null}
        </div>
      );
    });

  return (
    <Card className={cls("flex flex-col", props.panelH)}>
      <div className="sticky top-0 z-10 border-b bg-[var(--to-surface)] p-4" style={{ borderColor: "var(--to-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Workforce</div>
            <div className="text-xs text-[var(--to-ink-muted)]">{props.shiftDate}</div>
          </div>

          <Button
            variant="secondary"
            className="h-8 px-3 text-sm"
            onClick={props.loadRefresh}
            disabled={props.loadingWorkforce || props.loadingRollup || props.loadingNotScheduled}
          >
            {props.loadingWorkforce || props.loadingRollup || props.loadingNotScheduled ? "Refreshing…" : "Refresh"}
          </Button>
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
            <SummaryChip
              label={props.logFilter === "ALL" ? "All" : "Clear filter"}
              active={props.logFilter === "ALL"}
              onClick={() => props.setLogFilter("ALL")}
            />
            <SummaryChip
              label={`${props.summary.call_out_count} no shows`}
              active={props.logFilter === "CALL_OUT"}
              onClick={() => props.setLogFilter(props.logFilter === "CALL_OUT" ? "ALL" : "CALL_OUT")}
            />
            <SummaryChip
              label={`${props.summary.add_in_count} add ins`}
              active={props.logFilter === "ADD_IN"}
              onClick={() => props.setLogFilter(props.logFilter === "ADD_IN" ? "ALL" : "ADD_IN")}
            />
            <SummaryChip
              label={`${props.summary.bp_low_count ?? 0} BP-low`}
              active={props.logFilter === "BP_LOW"}
              onClick={() => props.setLogFilter(props.logFilter === "BP_LOW" ? "ALL" : "BP_LOW")}
            />
            <SummaryChip
              label={`${props.summary.incident_count} incidents`}
              active={props.logFilter === "INCIDENT"}
              onClick={() => props.setLogFilter(props.logFilter === "INCIDENT" ? "ALL" : "INCIDENT")}
            />
            <SummaryChip
              label={`${techMoveCount} tech moves`}
              active={props.logFilter === "TECH_MOVE"}
              onClick={() => props.setLogFilter(props.logFilter === "TECH_MOVE" ? "ALL" : "TECH_MOVE")}
            />
            <SummaryChip
              label={`${props.summary.note_count} notes`}
              active={props.logFilter === "NOTE"}
              onClick={() => props.setLogFilter(props.logFilter === "NOTE" ? "ALL" : "NOTE")}
            />
            <SummaryChip
              label={`Quota ${props.summary.quota_routes_required} routes`}
              active={false}
              onClick={() => props.setLogFilter("ALL")}
            />
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="grid gap-6">
          <div className="grid gap-2">
            <SectionLabel title="Scheduled" count={scheduledFiltered.length} />
            {scheduledFiltered.length === 0 ? (
              <div className="text-sm text-[var(--to-ink-muted)]">No scheduled techs match your filters.</div>
            ) : (
              renderRows(scheduledFiltered, "SCHEDULED")
            )}
          </div>

          <div className="grid gap-2">
            <SectionLabel title="Not Scheduled" count={notScheduledFiltered.length} />
            {notScheduledFiltered.length === 0 ? (
              <div className="text-sm text-[var(--to-ink-muted)]">No not-scheduled techs match your filters.</div>
            ) : (
              renderRows(notScheduledFiltered, "NOT_SCHEDULED")
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}