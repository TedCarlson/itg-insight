// RUN THIS
// Replace the entire file:
// apps/web/src/features/dispatch-console/page.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageShell, PageHeader } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextInput } from "@/components/ui/TextInput";
import { Notice } from "@/components/ui/Notice";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

import { useOrg } from "@/state/org";
import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";

type EventType = "ALL" | "CALL_OUT" | "ADD_IN" | "INCIDENT" | "NOTE" | "TECH_MOVE";
type EntryType = Exclude<EventType, "ALL">;

type WorkforceRow = {
  pc_org_id: string;
  shift_date: string;

  assignment_id: string;
  person_id: string;
  tech_id: string;
  affiliation_id: string | null;

  full_name: string;
  co_name: string | null;

  planned_route_id: string | null;
  planned_route_name: string | null;

  planned_start_time: string | null;
  planned_end_time: string | null;

  planned_hours: number | null;
  planned_units: number | null;

  sv_built: boolean | null;
  sv_route_id: string | null;
  sv_route_name: string | null;

  checked_in_at: string | null;

  schedule_as_of: string | null;
  sv_as_of: string | null;
  check_in_as_of: string | null;
};

type DaySummary = {
  pc_org_id: string;
  shift_date: string;

  tech_count: number;
  built_count: number;
  checked_in_count: number;

  call_out_count: number;
  add_in_count: number;
  incident_count: number;
  note_count: number;

  net_capacity_delta_routes: number;

  quota_hours: number;
  quota_units: number;
  quota_routes_required: number;
  quota_as_of: string | null;
};

type LogRow = {
  dispatch_console_log_id: string;
  pc_org_id: string;
  shift_date: string;
  assignment_id: string;
  person_id: string;
  tech_id: string;
  affiliation_id: string | null;
  event_type: "CALL_OUT" | "ADD_IN" | "INCIDENT" | "NOTE" | "TECH_MOVE";
  capacity_delta_routes: number;
  message: string;
  created_at: string;
  created_by_user_id: string;
};

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtDelta(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function deltaForEntry(t: EntryType) {
  if (t === "CALL_OUT") return -1;
  if (t === "ADD_IN") return 1;
  return 0;
}

function labelForEvent(t: LogRow["event_type"]) {
  if (t === "CALL_OUT") return "Call Out";
  if (t === "ADD_IN") return "Add In";
  if (t === "INCIDENT") return "Incident";
  if (t === "TECH_MOVE") return "Tech Move";
  return "Note";
}

function routeLabel(r: { planned_route_name?: string | null; planned_route_id?: string | null }) {
  const name = (r.planned_route_name ?? "").trim();
  if (name) return name;

  const id = (r.planned_route_id ?? "").trim();
  if (id) return `Route ${id.slice(0, 8)}`;

  return "Unassigned";
}

const EVENT_ORDER: EntryType[] = ["CALL_OUT", "ADD_IN", "INCIDENT", "TECH_MOVE", "NOTE"];

export default function DispatchConsolePage() {
  const { selectedOrgId } = useOrg();
  const toast = useToast();

  const [shiftDate] = useState<string>(() => todayInNY());
  const pc_org_id = selectedOrgId;

  const [loadingWorkforce, setLoadingWorkforce] = useState(false);
  const [workforce, setWorkforce] = useState<WorkforceRow[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);

  const [workforceQuery, setWorkforceQuery] = useState("");

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const [logFilter, setLogFilter] = useState<EventType>("ALL");
  const [loadingLog, setLoadingLog] = useState(false);
  const [logRows, setLogRows] = useState<LogRow[]>([]);

  // Day-wide rollup for workforce chips
  const [loadingRollup, setLoadingRollup] = useState(false);
  const [logRollupRows, setLogRollupRows] = useState<LogRow[]>([]);

  const [entryType, setEntryType] = useState<EntryType>("NOTE");
  const [message, setMessage] = useState("");

  const selectedTech = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return workforce.find((r) => r.assignment_id === selectedAssignmentId) ?? null;
  }, [selectedAssignmentId, workforce]);

  const filteredWorkforce = useMemo(() => {
    const q = workforceQuery.trim().toLowerCase();
    if (!q) return workforce;
    return workforce.filter((r) => {
      const name = (r.full_name ?? "").toLowerCase();
      const tech = String(r.tech_id ?? "").toLowerCase();
      const co = (r.co_name ?? "").toLowerCase();
      return name.includes(q) || tech.includes(q) || co.includes(q);
    });
  }, [workforce, workforceQuery]);

  // assignment_id -> ordered list of unique event types present that day
  const chipsByAssignment = useMemo(() => {
    const m = new Map<string, Set<EntryType>>();
    for (const r of logRollupRows) {
      const set = m.get(r.assignment_id) ?? new Set<EntryType>();
      set.add(r.event_type as EntryType);
      m.set(r.assignment_id, set);
    }
    const out = new Map<string, EntryType[]>();
    for (const [aid, set] of m.entries()) {
      const ordered = EVENT_ORDER.filter((t) => set.has(t));
      out.set(aid, ordered);
    }
    return out;
  }, [logRollupRows]);

  const loadWorkforce = useCallback(async () => {
    if (!pc_org_id) return;

    // Clean start after refresh/load
    setSelectedAssignmentId(null);

    setLoadingWorkforce(true);
    try {
      const res = await fetch(
        `/api/dispatch-console/workforce?pc_org_id=${encodeURIComponent(pc_org_id)}&shift_date=${encodeURIComponent(
          shiftDate
        )}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to load workforce");

      const rows = (Array.isArray(json?.rows) ? json.rows : []) as WorkforceRow[];
      setWorkforce(rows);
      setSummary((json?.summary ?? null) as DaySummary | null);
    } catch (e: any) {
      toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to load workforce", variant: "danger" });
      setWorkforce([]);
      setSummary(null);
    } finally {
      setLoadingWorkforce(false);
    }
  }, [pc_org_id, shiftDate, toast]);

  // Day-wide log for chips (no assignment_id filter, no event_type filter)
  const loadLogRollup = useCallback(async () => {
    if (!pc_org_id) return;

    setLoadingRollup(true);
    try {
      const qs = new URLSearchParams();
      qs.set("pc_org_id", pc_org_id);
      qs.set("shift_date", shiftDate);

      const res = await fetch(`/api/dispatch-console/log?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to load log rollup");

      setLogRollupRows((Array.isArray(json?.rows) ? json.rows : []) as LogRow[]);
    } catch (e: any) {
      toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to load log rollup", variant: "danger" });
      setLogRollupRows([]);
    } finally {
      setLoadingRollup(false);
    }
  }, [pc_org_id, shiftDate, toast]);

  // Visible log list (respects filters + selected tech)
  const loadLog = useCallback(async () => {
    if (!pc_org_id) return;

    setLoadingLog(true);
    try {
      const qs = new URLSearchParams();
      qs.set("pc_org_id", pc_org_id);
      qs.set("shift_date", shiftDate);
      if (logFilter !== "ALL") qs.set("event_type", logFilter);
      if (selectedAssignmentId) qs.set("assignment_id", selectedAssignmentId);

      const res = await fetch(`/api/dispatch-console/log?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to load log");

      setLogRows((Array.isArray(json?.rows) ? json.rows : []) as LogRow[]);
    } catch (e: any) {
      toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to load log", variant: "danger" });
      setLogRows([]);
    } finally {
      setLoadingLog(false);
    }
  }, [pc_org_id, shiftDate, selectedAssignmentId, logFilter, toast]);

  useEffect(() => {
    if (!pc_org_id) return;
    void loadWorkforce();
    void loadLogRollup();
  }, [pc_org_id, shiftDate, loadWorkforce, loadLogRollup]);

  useEffect(() => {
    if (!pc_org_id) return;
    void loadLog();
  }, [pc_org_id, shiftDate, selectedAssignmentId, logFilter, loadLog]);

  const submit = useCallback(async () => {
    if (!pc_org_id) return;

    if (!selectedAssignmentId) {
      toast.push({ title: "Dispatch Console", message: "Select a technician first.", variant: "warning" });
      return;
    }

    const msg = message.trim();
    if (!msg) {
      toast.push({ title: "Dispatch Console", message: "Message is required.", variant: "warning" });
      return;
    }

    try {
      const res = await fetch("/api/dispatch-console/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pc_org_id,
          shift_date: shiftDate,
          assignment_id: selectedAssignmentId,
          event_type: entryType,
          message: msg,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to add log entry");

      setMessage("");
      await loadWorkforce(); // refresh summary + list
      await loadLog(); // refresh visible log
      await loadLogRollup(); // refresh chips
    } catch (e: any) {
      toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to add log entry", variant: "danger" });
    }
  }, [pc_org_id, shiftDate, selectedAssignmentId, entryType, message, toast, loadWorkforce, loadLog, loadLogRollup]);

  if (!pc_org_id) {
    return (
      <PageShell>
        <PageHeader title="Dispatch Console" subtitle="Select a PC Org to begin." />
        <Notice title="Select an org" variant="warning">
          Choose a PC Org to load the Dispatch Console.
        </Notice>
      </PageShell>
    );
  }

  // shared "panel" height for internal scroll areas
  const panelH = "lg:h-[calc(100vh-260px)]";

  return (
    <PageShell>
      <PageHeader title="Dispatch Console" subtitle="Daily workforce + immutable dispatch chronicle." />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT: Workforce */}
        <Card className={cls("lg:col-span-5 flex flex-col", panelH)}>
          {/* Sticky header */}
          <div
            className="sticky top-0 z-10 border-b bg-[var(--to-surface)] p-4"
            style={{ borderColor: "var(--to-border)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Workforce</div>
                <div className="text-xs text-[var(--to-ink-muted)]">{shiftDate}</div>
              </div>

              <Button
                variant="secondary"
                className="h-8 px-3 text-sm"
                onClick={() => {
                  void loadWorkforce();
                  void loadLogRollup();
                }}
                disabled={loadingWorkforce || loadingRollup}
              >
                {loadingWorkforce || loadingRollup ? "Refreshing…" : "Refresh"}
              </Button>
            </div>

            <div className="mt-3">
              <TextInput
                value={workforceQuery}
                onChange={(e) => setWorkforceQuery(e.target.value)}
                placeholder="Search name or tech id…"
              />
            </div>

            {summary ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{summary.call_out_count} call outs</Badge>
                <Badge>{summary.add_in_count} add ins</Badge>
                <Badge>{summary.incident_count} incidents</Badge>

                {(() => {
                  const cap = summary.tech_count + summary.net_capacity_delta_routes;
                  const below = cap < summary.quota_routes_required;
                  return <Badge variant={below ? "danger" : "neutral"}>Techs {cap}</Badge>;
                })()}

                <Badge>Quota {summary.quota_routes_required} routes</Badge>
                <Badge>Δ {fmtDelta(summary.net_capacity_delta_routes)}</Badge>
              </div>
            ) : null}
          </div>

          {/* Scroll body */}
          <div className="flex-1 overflow-auto px-4 py-4">
            {filteredWorkforce.length === 0 ? (
              <div className="text-sm text-[var(--to-ink-muted)]">No scheduled techs for this day.</div>
            ) : (
              <div className="grid gap-2">
                {filteredWorkforce.map((r) => {
                  const active = r.assignment_id === selectedAssignmentId;
                  const chips = chipsByAssignment.get(r.assignment_id) ?? [];

                  return (
                    <button
                      key={r.assignment_id}
                      type="button"
                      onClick={() => setSelectedAssignmentId(r.assignment_id)}
                      className={cls(
                        "w-full rounded-xl border px-3 py-2 text-left transition",
                        active
                          ? "ring-2 ring-[var(--to-focus)] bg-[var(--to-row-hover)]"
                          : "hover:bg-[var(--to-row-hover)]"
                      )}
                      style={{ borderColor: "var(--to-border)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {r.full_name}{" "}
                            <span className="text-xs text-[var(--to-ink-muted)]">({r.tech_id})</span>
                          </div>

                          {/* ✅ HUMAN READ: prefer route name, fallback to id */}
                          <div className="mt-0.5 text-xs text-[var(--to-ink-muted)]">
                            {r.planned_hours ?? "—"}h / {r.planned_units ?? "—"}u • {routeLabel(r)}
                          </div>
                        </div>

                        {chips.length ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {chips.map((t) => (
                              <Badge key={t}>{labelForEvent(t as any)}</Badge>
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

          {/* Sticky footer (reserved) */}
          <div
            className="sticky bottom-0 border-t bg-[var(--to-surface)] px-4 py-2"
            style={{ borderColor: "var(--to-border)" }}
          >
            <div className="text-[11px] text-[var(--to-ink-muted)]"> </div>
          </div>
        </Card>

        {/* RIGHT */}
        <div className={cls("lg:col-span-7 grid gap-4", panelH)}>
          {/* Top right: Tech selected */}
          <Card className="border" style={{ borderColor: "var(--to-border)" }}>
            <div className="p-4">
              <div className="text-sm font-semibold">Tech selected</div>
              <div className="text-xs text-[var(--to-ink-muted)]">
                {selectedTech
                  ? `${selectedTech.full_name} (${selectedTech.tech_id})`
                  : "Select a technician on the left"}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SegmentedControl<EntryType>
                  value={entryType}
                  onChange={setEntryType}
                  size="sm"
                  options={[
                    { value: "CALL_OUT", label: "Call Out" },
                    { value: "ADD_IN", label: "Add In" },
                    { value: "INCIDENT", label: "Incident" },
                    { value: "TECH_MOVE", label: "Tech Move" },
                    { value: "NOTE", label: "Note" },
                  ]}
                />
                <div className="text-xs text-[var(--to-ink-muted)]">Δ {fmtDelta(deltaForEntry(entryType))}</div>
              </div>

              <div className="mt-3">
                <TextInput
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type the dispatch note…"
                />
              </div>

              <div className="mt-3 flex justify-end">
                <Button onClick={submit} disabled={!selectedAssignmentId} className="h-9 px-4">
                  Add
                </Button>
              </div>
            </div>
          </Card>

          {/* Bottom right: Day log */}
          <Card className="flex flex-col min-h-0">
            {/* Sticky header */}
            <div
              className="sticky top-0 z-10 border-b bg-[var(--to-surface)] p-4"
              style={{ borderColor: "var(--to-border)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Day log</div>
                  <div className="text-xs text-[var(--to-ink-muted)]">{shiftDate}</div>
                </div>

                <Button variant="secondary" className="h-8 px-3 text-sm" onClick={() => loadLog()} disabled={loadingLog}>
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
                    { value: "CALL_OUT", label: "Call Out" },
                    { value: "ADD_IN", label: "Add In" },
                    { value: "INCIDENT", label: "Incident" },
                    { value: "TECH_MOVE", label: "Tech Move" },
                    { value: "NOTE", label: "Note" },
                  ]}
                />
              </div>
            </div>

            {/* Scroll body */}
            <div className="flex-1 overflow-auto px-4 py-4 min-h-0">
              {logRows.length === 0 ? (
                <div className="text-sm text-[var(--to-ink-muted)]">No entries yet.</div>
              ) : (
                <div className="grid gap-2">
                  {logRows.map((r) => (
                    <div
                      key={r.dispatch_console_log_id}
                      className="rounded-xl border px-3 py-2"
                      style={{ borderColor: "var(--to-border)" }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{labelForEvent(r.event_type)}</Badge>
                        {r.capacity_delta_routes !== 0 ? <Badge>Δ {fmtDelta(r.capacity_delta_routes)}</Badge> : null}
                        <span className="text-xs text-[var(--to-ink-muted)]">
                          {new Date(r.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1 text-sm leading-snug">{r.message}</div>
                      <div className="mt-1 text-xs text-[var(--to-ink-muted)]">{r.tech_id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sticky footer (reserved) */}
            <div
              className="sticky bottom-0 border-t bg-[var(--to-surface)] px-4 py-2"
              style={{ borderColor: "var(--to-border)" }}
            >
              <div className="text-[11px] text-[var(--to-ink-muted)]"> </div>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}