"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

import type { EventType, LogRow } from "../lib/types";
import { chipClassForEvent, labelForEvent } from "../lib/labels";

function EventChip(props: { t: LogRow["event_type"] }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[11px]"
      style={{ borderColor: "var(--to-border)", ...chipClassForEvent(props.t) }}
    >
      {labelForEvent(props.t)}
    </span>
  );
}

export function DayLogPanel(props: {
  panelH: string;
  shiftDate: string;

  logFilter: EventType;
  setLogFilter: (v: EventType) => void;

  loadingLog: boolean;
  onRefresh: () => void;

  logRows: LogRow[];

  userId: string | null | undefined;

  onBeginEdit: (row: LogRow) => void;
  onDeleteNote: (row: LogRow) => void;
}) {
  const canEditRow = (row: LogRow) =>
    !!props.userId && String(row.created_by_user_id) === String(props.userId);

  const canEditNote = (row: LogRow) => canEditRow(row) && row.event_type === "NOTE";

  return (
    <Card className={props.panelH} style={{ borderColor: "var(--to-border)" }}>
      <div
        className="sticky top-0 z-10 border-b bg-[var(--to-surface)] p-4"
        style={{ borderColor: "var(--to-border)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">History</div>
            <div className="text-xs text-[var(--to-ink-muted)]">{props.shiftDate}</div>
          </div>

          <Button
            variant="secondary"
            className="h-8 px-3 text-sm"
            onClick={props.onRefresh}
            disabled={props.loadingLog}
          >
            {props.loadingLog ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        <div className="mt-3">
          <SegmentedControl<EventType>
            value={props.logFilter}
            onChange={props.setLogFilter}
            size="sm"
            options={[
              { value: "ALL", label: "All" },
              { value: "CALL_OUT", label: "Call Out" },
              { value: "ADD_IN", label: "Add In" },
              { value: "BP_LOW", label: "BP-Low" },
              { value: "INCIDENT", label: "Incident" },
              { value: "TECH_MOVE", label: "Tech Move" },
              { value: "NOTE", label: "Note" },
            ]}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {props.logRows.length === 0 ? (
          <div className="text-sm text-[var(--to-ink-muted)]">No history entries.</div>
        ) : (
          <div className="grid gap-2">
            {props.logRows.map((row) => {
              const editableNote = canEditNote(row);

              return (
                <div
                  key={row.dispatch_console_log_id}
                  className="rounded-xl border px-3 py-2"
                  style={{ borderColor: "var(--to-border)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <EventChip t={row.event_type} />
                        <div className="text-xs text-[var(--to-ink-muted)]">
                          {row.created_at ? new Date(row.created_at).toLocaleTimeString() : ""}
                        </div>
                      </div>

                      <div className="mt-1 text-sm">{row.message ?? ""}</div>

                      {row.assignment_id ? (
                        <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                          Assignment {String(row.assignment_id)}
                        </div>
                      ) : null}
                    </div>

                    {editableNote ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          className="h-8 px-3 text-sm"
                          onClick={() => props.onBeginEdit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-8 px-3 text-sm text-red-600 hover:text-red-700"
                          onClick={() => props.onDeleteNote(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}