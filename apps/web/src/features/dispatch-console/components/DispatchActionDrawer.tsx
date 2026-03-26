"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import type { EntryType, LogRow, WorkforceRow } from "../lib/types";
import { labelForEvent } from "../lib/labels";

export function DispatchActionDrawer(props: {
  panelH: string;

  workforceTab: "SCHEDULED" | "NOT_SCHEDULED";

  tech: WorkforceRow | null;

  entryType: EntryType | null;
  setEntryType: (v: EntryType) => void;

  message: string;
  setMessage: (v: string) => void;

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
    { value: "CALL_OUT", label: "Call Out" },
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

  return (
    <Card className={`flex flex-col min-h-0 ${props.panelH}`} style={{ borderColor: "var(--to-border)" }}>
      <div className="sticky top-0 z-10 border-b bg-[var(--to-surface)] p-4" style={{ borderColor: "var(--to-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              {props.tech ? `${props.tech.full_name} (${String(props.tech.tech_id ?? "").trim()})` : "Action Drawer"}
            </div>
            <div className="text-xs text-[var(--to-ink-muted)]">
              {props.tech ? "Row-scoped action + history" : "Select a technician to begin"}
            </div>
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

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1">
            <input
              value={props.message}
              onChange={(e) => props.setMessage(e.target.value)}
              placeholder={props.editing ? "Edit the note…" : "Select an action type first…"}
              disabled={!props.entryType && !props.editing}
              className="h-9 w-full rounded-lg border bg-[var(--to-surface)] px-3 text-sm outline-none"
              style={{ borderColor: "var(--to-border)", color: "var(--to-ink)" }}
            />
          </div>

          <Button onClick={props.onSubmit} disabled={!props.canSubmit} className="h-9 px-4">
            {props.editing ? "Save" : "Add"}
          </Button>
        </div>

        {!props.entryType && !props.editing ? (
          <div className="mt-2 text-xs text-[var(--to-ink-muted)]">
            No default action selected. Choose an action to prefill the message.
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 min-h-0">
        {!props.tech ? (
          <div className="text-sm text-[var(--to-ink-muted)]">Select a technician row to open the drawer.</div>
        ) : props.logRows.length === 0 ? (
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

              const showActions = mine && r.event_type === "NOTE";

              return (
                <div
                  key={r.dispatch_console_log_id}
                  className="rounded-xl border px-3 py-2"
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
    </Card>
  );
}