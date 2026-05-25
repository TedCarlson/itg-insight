// Path: apps/web/src/features/dispatch-console/components/DispatchInlineRowDrawer.tsx

"use client";

import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";

import type { DispatchRouteOption, EntryType, LogRow, WorkforceRow, WorkforceTab } from "../lib/types";
import { labelForEvent } from "../lib/labels";

function optionLabel(opt: DispatchRouteOption) {
  const techPreview = opt.tech_labels.length ? ` · ${opt.tech_labels.join(", ")}` : "";
  return `${opt.route_name}${opt.tech_count ? ` · ${opt.tech_count} tech${opt.tech_count === 1 ? "" : "s"}` : ""}${techPreview}`;
}

export function DispatchInlineRowDrawer(props: {
  workforceTab: WorkforceTab;
  tech: WorkforceRow;

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
  onRefresh: () => void;

  userId: string | null;
  onBeginEdit: (row: LogRow) => void;
  onDeleteNote: (row: LogRow) => void;
}) {
  const entryOptionsScheduled: Array<{ value: EntryType; label: string }> = [
    { value: "CALL_OUT", label: "No Show" },
    { value: "ADD_IN", label: "Add In" },
    { value: "BP_LOW", label: "BP-Low" },
    { value: "INCIDENT", label: "Incident" },
    { value: "TECH_MOVE", label: "Tech Move" },
    { value: "NOTE", label: "Note" },
  ];

  const entryOptionsNotScheduled: Array<{ value: EntryType; label: string }> = [
    { value: "ADD_IN", label: "Add In" },
    { value: "NOTE", label: "Note" },
  ];

  const options = props.workforceTab === "NOT_SCHEDULED" ? entryOptionsNotScheduled : entryOptionsScheduled;
  const inputDisabled = !props.editing && !props.entryType;
  const showTechMoveControls = props.entryType === "TECH_MOVE" && !props.editing;

  return (
    <div
      className="rounded-xl border border-t-0 bg-[var(--to-surface-2)] px-4 py-3"
      style={{ borderColor: "var(--to-border)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--to-ink-muted)]">Action entry + technician history</div>
        </div>

        <Button variant="secondary" className="h-8 px-3 text-sm" onClick={props.onRefresh} disabled={props.loadingLog}>
          {props.loadingLog ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = props.entryType === opt.value;
          return (
            <Button
              key={opt.value}
              type="button"
              variant={active ? "primary" : "secondary"}
              className="h-8 px-3 text-sm"
              onClick={() => props.setEntryType(opt.value)}
              disabled={props.editing}
            >
              {opt.label}
            </Button>
          );
        })}

        <Button variant="secondary" className="h-8 px-3 text-sm" onClick={props.onClearOrCancel}>
          {props.editing ? "Cancel" : "Clear"}
        </Button>
      </div>

      {showTechMoveControls ? (
        <div
          className="mt-3 grid gap-3 rounded-lg border bg-[var(--to-surface)] p-3 md:grid-cols-[1fr_1fr]"
          style={{ borderColor: "var(--to-border)" }}
        >
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--to-ink-muted)]">
              From route
            </div>
            <div className="mt-1 rounded-lg border bg-[var(--to-surface-2)] px-3 py-2 text-sm" style={{ borderColor: "var(--to-border)" }}>
              {props.techMoveFromRouteName || props.techMoveFromRouteId || "No current route"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--to-ink-muted)]">
              To route
            </div>
            <select
              className="mt-1 h-10 w-full rounded-lg border bg-[var(--to-surface)] px-3 text-sm text-[var(--to-ink)] outline-none"
              style={{ borderColor: "var(--to-border)" }}
              value={props.techMoveToRouteId}
              onChange={(e) => {
                const routeId = e.target.value;
                const opt = props.routeOptions.find((r) => r.route_id === routeId);
                props.setTechMoveDestination(routeId, opt?.route_name ?? "");
              }}
            >
              <option value="">Choose destination route…</option>
              {props.routeOptions.map((opt) => (
                <option key={opt.route_id || opt.route_name} value={opt.route_id}>
                  {optionLabel(opt)}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
              This will log the move and mark schedule baseline work as pending.
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 max-w-[980px]">
        <div
          className="flex items-center gap-2 rounded-lg border bg-[var(--to-surface)] p-2"
          style={{ borderColor: "var(--to-border)" }}
        >
          <div className="min-w-0 flex-1">
            <TextInput
              value={props.message}
              onChange={(e) => props.setMessage(e.target.value)}
              placeholder={props.editing ? "Edit the note…" : "Choose an action type to prefill the message…"}
              disabled={inputDisabled}
            />
          </div>

          <Button onClick={props.onSubmit} disabled={!props.canSubmit} className="h-9 shrink-0 px-4">
            {props.editing ? "Save" : "Add"}
          </Button>
        </div>
      </div>

      {!props.entryType && !props.editing ? (
        <div className="mt-2 text-xs text-[var(--to-ink-muted)]">
          No default entry type selected. Choose an action to begin.
        </div>
      ) : null}

      <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--to-border)" }}>
        {props.logRows.length === 0 ? (
          <div className="text-sm text-[var(--to-ink-muted)]">No entries yet for this technician.</div>
        ) : (
          <div className="grid gap-2">
            {props.logRows.map((r) => {
              const mine = !!props.userId && String(r.created_by_user_id) === String(props.userId);
              const whoRaw = String((r as any).created_by_name ?? "").trim();
              const who = mine ? "You" : whoRaw || "Unknown";

              const time = (() => {
                try {
                  return new Date(r.created_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                } catch {
                  return "";
                }
              })();

              const showActions = mine;

              return (
                <div
                  key={r.dispatch_console_log_id}
                  className="rounded-xl border bg-[var(--to-surface)] px-3 py-2"
                  style={{ borderColor: "var(--to-border)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11px]"
                          style={{ borderColor: "var(--to-border)", background: "var(--to-surface-2)" }}
                        >
                          {labelForEvent(r.event_type)}
                        </span>
                        {time ? <span className="text-xs text-[var(--to-ink-muted)]">{time}</span> : null}
                      </div>

                      <div className="mt-0.5 text-xs text-[var(--to-ink-muted)]">Created by {who}</div>
                    </div>

                    {showActions ? (
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => props.onBeginEdit(r)}>
                          Edit
                        </Button>
                        <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => props.onDeleteNote(r)}>
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 text-sm leading-snug">{r.message}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}