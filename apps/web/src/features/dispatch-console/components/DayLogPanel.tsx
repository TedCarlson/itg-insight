"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

import type { EventType, LogRow } from "../lib/types";

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function labelForEvent(t: LogRow["event_type"]) {
  if (t === "CALL_OUT") return "No Show";
  if (t === "ADD_IN") return "Add In";
  if (t === "BP_LOW") return "BP-Low";
  if (t === "INCIDENT") return "Incident";
  if (t === "TECH_MOVE") return "Tech Move";
  return "Note";
}

export function DayLogPanel(props: {
  panelH: string;
  shiftDate: string;
  logFilter: EventType;
  setLogFilter: (v: EventType) => void;
  loadingLog: boolean;
  onRefresh: () => void;

  logRows: LogRow[];
  userId: string | null;

  onBeginEdit: (row: LogRow) => void;
  onDeleteNote: (row: LogRow) => void;
}) {
  const { panelH, shiftDate, logFilter, setLogFilter, loadingLog, onRefresh, logRows, userId, onBeginEdit, onDeleteNote } =
    props;

  return (
    <Card className={cls("flex flex-col min-h-0", panelH)}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-[var(--to-surface)] p-4" style={{ borderColor: "var(--to-border)" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">History</div>
            <div className="text-xs text-[var(--to-ink-muted)]">{shiftDate}</div>
          </div>

          <Button variant="secondary" className="h-8 px-3 text-sm" onClick={onRefresh} disabled={loadingLog}>
            {loadingLog ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        <div className="mt-3">
          <SegmentedControl<EventType>
            value={logFilter}
            onChange={setLogFilter}
            size="sm"
            options={[
              { value: "ALL", label: "All" },
              { value: "CALL_OUT", label: "No Show" },
              { value: "ADD_IN", label: "Add In" },
              { value: "BP_LOW", label: "BP-Low" },
              { value: "INCIDENT", label: "Incident" },
              { value: "TECH_MOVE", label: "Tech Move" },
              { value: "NOTE", label: "Note" },
            ]}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-4 min-h-0">
        {logRows.length === 0 ? (
          <div className="text-sm text-[var(--to-ink-muted)]">No entries yet.</div>
        ) : (
          <div className="grid gap-2">
            {logRows.map((r) => {
              const mine = !!userId && String(r.created_by_user_id) === String(userId);

              const whoRaw = String((r as any).created_by_name ?? "").trim();
              const who = mine ? "You" : whoRaw || "Unknown";

              const time = (() => {
                try {
                  return new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
                } catch {
                  return "";
                }
              })();

              const tech = (r.tech_id ?? "").toString().trim();
              const showActions = mine && r.event_type === "NOTE"; // guardrail: creator-only + NOTE-only edits

              return (
                <div
                  key={r.dispatch_console_log_id}
                  className="rounded-xl border px-3 py-2"
                  style={{ borderColor: "var(--to-border)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{labelForEvent(r.event_type)}</Badge>
                        {time ? <span className="text-xs text-[var(--to-ink-muted)]">{time}</span> : null}
                      </div>

                      <div className="mt-0.5 text-xs text-[var(--to-ink-muted)]">Created by {who}</div>
                    </div>

                    {showActions ? (
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => onBeginEdit(r)}>
                          Edit
                        </Button>
                        <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => onDeleteNote(r)}>
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 text-sm leading-snug">{r.message}</div>

                  {/* ✅ Durable human fallback (never show assignment UUID on cards) */}
                  {tech ? <div className="mt-1 text-xs text-[var(--to-ink-muted)]">Tech {tech}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-[var(--to-surface)] px-4 py-2" style={{ borderColor: "var(--to-border)" }}>
        <div className="text-[11px] text-[var(--to-ink-muted)]"> </div>
      </div>
    </Card>
  );
}