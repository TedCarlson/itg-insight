"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type EventType = "ALL" | "CALL_OUT" | "ADD_IN" | "BP_LOW" | "INCIDENT" | "NOTE" | "TECH_MOVE";
type EntryType = Exclude<EventType, "ALL">;

type WorkforceTab = "SCHEDULED" | "NOT_SCHEDULED";

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
  bp_low_count?: number;
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
  event_type: "CALL_OUT" | "ADD_IN" | "BP_LOW" | "INCIDENT" | "NOTE" | "TECH_MOVE";
  capacity_delta_routes: number;
  message: string;
  created_at: string;
  created_by_user_id: string;

  created_by_name?: string | null;
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
  return 0; // BP_LOW / INCIDENT / NOTE / TECH_MOVE
}

function labelForEvent(t: LogRow["event_type"]) {
  if (t === "CALL_OUT") return "Call Out";
  if (t === "ADD_IN") return "Add In";
  if (t === "BP_LOW") return "BP-Low";
  if (t === "INCIDENT") return "Incident";
  if (t === "TECH_MOVE") return "Tech Move";
  return "Note";
}

function labelForEntryType(t: EntryType) {
  if (t === "CALL_OUT") return "Call Out";
  if (t === "ADD_IN") return "Add In";
  if (t === "BP_LOW") return "BP-Low";
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

function buildAutoDraft(entryType: EntryType, tech: WorkforceRow) {
  const t = String(tech.tech_id ?? "").trim();
  const n = String(tech.full_name ?? "").trim();
  const r = routeLabel(tech);
  return `${labelForEntryType(entryType)} — ${t} • ${n} • ${r}`;
}

const EVENT_ORDER: EntryType[] = ["CALL_OUT", "ADD_IN", "BP_LOW", "INCIDENT", "TECH_MOVE", "NOTE"];

export default function DispatchConsolePage() {
  const { selectedOrgId } = useOrg();
  const toast = useToast();

  const [shiftDate] = useState<string>(() => todayInNY());
  const pc_org_id = selectedOrgId;

  const [workforceTab, setWorkforceTab] = useState<WorkforceTab>("SCHEDULED");

  const [loadingWorkforce, setLoadingWorkforce] = useState(false);
  const [workforce, setWorkforce] = useState<WorkforceRow[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);

  const [loadingNotScheduled, setLoadingNotScheduled] = useState(false);
  const [notScheduled, setNotScheduled] = useState<WorkforceRow[]>([]);

  const [nameQuery, setNameQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const [logFilter, setLogFilter] = useState<EventType>("ALL");
  const [loadingLog, setLoadingLog] = useState(false);
  const [logRows, setLogRows] = useState<LogRow[]>([]);

  const [loadingRollup, setLoadingRollup] = useState(false);
  const [logRollupRows, setLogRollupRows] = useState<LogRow[]>([]);

  const [entryType, setEntryType] = useState<EntryType>("NOTE");
  const [message, setMessage] = useState("");

  const lastAutoDraftRef = useRef<string>("");

  const clearDraft = useCallback(() => {
    setMessage("");
    lastAutoDraftRef.current = "";
    setSelectedAssignmentId(null);
  }, []);

  // Restrict entry types when tab = NOT_SCHEDULED
  useEffect(() => {
    if (workforceTab !== "NOT_SCHEDULED") return;
    if (entryType !== "ADD_IN" && entryType !== "NOTE") {
      setEntryType("ADD_IN");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workforceTab]);

  const displayedWorkforce = workforceTab === "SCHEDULED" ? workforce : notScheduled;

  const selectedTech = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return displayedWorkforce.find((r) => r.assignment_id === selectedAssignmentId) ?? null;
  }, [selectedAssignmentId, displayedWorkforce]);

  useEffect(() => {
    if (!selectedTech) return;

    const nextAuto = buildAutoDraft(entryType, selectedTech);
    const cur = message.trim();
    const lastAuto = lastAutoDraftRef.current.trim();

    const safeToReplace = cur.length === 0 || cur === lastAuto;

    if (safeToReplace) {
      setMessage(nextAuto);
    }

    lastAutoDraftRef.current = nextAuto;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTech?.assignment_id, selectedTech?.planned_route_id, selectedTech?.planned_route_name, entryType]);

  const filteredWorkforce = useMemo(() => {
    const qName = nameQuery.trim().toLowerCase();
    const qRoute = routeQuery.trim().toLowerCase();

    return displayedWorkforce.filter((r) => {
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
  }, [displayedWorkforce, nameQuery, routeQuery]);

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

  const loadNotScheduled = useCallback(async () => {
    if (!pc_org_id) return;

    setLoadingNotScheduled(true);
    try {
      const res = await fetch(
        `/api/dispatch-console/not-scheduled?pc_org_id=${encodeURIComponent(pc_org_id)}&shift_date=${encodeURIComponent(
          shiftDate
        )}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to load not scheduled list");

      setNotScheduled((Array.isArray(json?.rows) ? json.rows : []) as WorkforceRow[]);
    } catch (e: any) {
      toast.push({
        title: "Dispatch Console",
        message: e?.message ?? "Failed to load not scheduled list",
        variant: "danger",
      });
      setNotScheduled([]);
    } finally {
      setLoadingNotScheduled(false);
    }
  }, [pc_org_id, shiftDate, toast]);

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

  // Lazy load not-scheduled list only when the tab is used
  useEffect(() => {
    if (!pc_org_id) return;
    if (workforceTab !== "NOT_SCHEDULED") return;
    void loadNotScheduled();
  }, [pc_org_id, workforceTab, loadNotScheduled]);

  useEffect(() => {
    if (!pc_org_id) return;
    void loadLog();
  }, [pc_org_id, shiftDate, selectedAssignmentId, logFilter, loadLog]);

  const submit = useCallback(async () => {
    if (!pc_org_id) return;

    if (entryType !== "NOTE" && !selectedAssignmentId) {
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
          assignment_id: entryType === "NOTE" ? (selectedAssignmentId ?? null) : selectedAssignmentId,
          event_type: entryType,
          message: msg,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to add log entry");

      setMessage("");
      lastAutoDraftRef.current = "";

      await loadWorkforce();
      if (workforceTab === "NOT_SCHEDULED") {
        await loadNotScheduled();
      }
      await loadLog();
      await loadLogRollup();
    } catch (e: any) {
      toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to add log entry", variant: "danger" });
    }
  }, [
    pc_org_id,
    shiftDate,
    selectedAssignmentId,
    entryType,
    message,
    toast,
    loadWorkforce,
    loadNotScheduled,
    loadLog,
    loadLogRollup,
    workforceTab,
  ]);

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

  const panelH = "lg:h-[calc(100vh-220px)]";

  const leftEmptyText =
    workforceTab === "SCHEDULED" ? "No scheduled techs match your filters." : "No roster techs are not scheduled today.";

  const entryOptionsScheduled = [
    { value: "CALL_OUT" as const, label: "Call Out" },
    { value: "ADD_IN" as const, label: "Add In" },
    { value: "BP_LOW" as const, label: "BP-Low" },
    { value: "INCIDENT" as const, label: "Incident" },
    { value: "TECH_MOVE" as const, label: "Tech Move" },
    { value: "NOTE" as const, label: "Note" },
  ];

  const entryOptionsNotScheduled = [
    { value: "ADD_IN" as const, label: "Add In" },
    { value: "NOTE" as const, label: "Note" },
  ];

  const canSubmit = Boolean(message.trim()) && (entryType === "NOTE" || Boolean(selectedAssignmentId));

  return (
    <PageShell>
      <PageHeader title="Dispatch Console" subtitle="Daily workforce + immutable dispatch chronicle." />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT */}
        <Card className={cls("lg:col-span-5 flex flex-col", panelH)}>
          <div
            className="sticky top-0 z-10 border-b bg-[var(--to-surface)] p-4"
            style={{ borderColor: "var(--to-border)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Workforce</div>
                <div className="text-xs text-[var(--to-ink-muted)]">{shiftDate}</div>
              </div>

              {/* Tabs + Refresh pill wrapper */}
              <div
                className="flex items-center gap-2 rounded-full border bg-[var(--to-surface)] p-1"
                style={{ borderColor: "var(--to-border)" }}
              >
                <SegmentedControl<WorkforceTab>
                  value={workforceTab}
                  onChange={(v) => {
                    setWorkforceTab(v);
                    setSelectedAssignmentId(null);
                    lastAutoDraftRef.current = "";
                  }}
                  size="sm"
                  options={[
                    { value: "SCHEDULED", label: "Scheduled" },
                    { value: "NOT_SCHEDULED", label: "Not scheduled" },
                  ]}
                />
                <Button
                  variant="secondary"
                  className="h-8 px-3 text-sm"
                  onClick={() => {
                    void loadWorkforce();
                    void loadLogRollup();
                    if (workforceTab === "NOT_SCHEDULED") void loadNotScheduled();
                  }}
                  disabled={loadingWorkforce || loadingRollup || loadingNotScheduled}
                >
                  {loadingWorkforce || loadingRollup || loadingNotScheduled ? "Refreshing…" : "Refresh"}
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <TextInput
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="Search name / tech id…"
              />
              <TextInput
                value={routeQuery}
                onChange={(e) => setRouteQuery(e.target.value)}
                placeholder="Filter route… (name/id/unassigned)"
              />
            </div>

            {summary ? (
              <div className="mt-3 flex flex-nowrap gap-2 overflow-hidden text-[11px]">
                <Badge className="text-[11px]">{summary.call_out_count} call outs</Badge>
                <Badge className="text-[11px]">{summary.add_in_count} add ins</Badge>
                <Badge className="text-[11px]">{(summary.bp_low_count ?? 0)} BP-low</Badge>
                <Badge className="text-[11px]">{summary.incident_count} incidents</Badge>

                {(() => {
                  const cap = summary.tech_count + summary.net_capacity_delta_routes;
                  const below = cap < summary.quota_routes_required;
                  return (
                    <Badge className="text-[11px]" variant={below ? "danger" : "neutral"}>
                      Techs {cap}
                    </Badge>
                  );
                })()}

                <Badge className="text-[11px]">Quota {summary.quota_routes_required} routes</Badge>
              </div>
            ) : null}
          </div>

          <div className="flex-1 overflow-auto px-4 py-4">
            {filteredWorkforce.length === 0 ? (
              <div className="text-sm text-[var(--to-ink-muted)]">{leftEmptyText}</div>
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

          <div
            className="sticky bottom-0 border-t bg-[var(--to-surface)] px-4 py-2"
            style={{ borderColor: "var(--to-border)" }}
          >
            <div className="text-[11px] text-[var(--to-ink-muted)]"> </div>
          </div>
        </Card>

        {/* RIGHT */}
        <div className={cls("lg:col-span-7 grid gap-4", panelH)}>
          {/* ✅ TOP: minimal entry bar */}
          <Card className="border" style={{ borderColor: "var(--to-border)" }}>
            <div className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SegmentedControl<EntryType>
                  value={entryType}
                  onChange={setEntryType}
                  size="sm"
                  options={workforceTab === "NOT_SCHEDULED" ? entryOptionsNotScheduled : entryOptionsScheduled}
                />

                <div className="flex items-center gap-2">
                  <Button variant="secondary" className="h-9 px-3" onClick={clearDraft}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1">
                  <TextInput
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type the dispatch note…"
                  />
                </div>

                <Button onClick={submit} disabled={!canSubmit} className="h-9 px-4">
                  Add
                </Button>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col min-h-0">
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
                    { value: "BP_LOW", label: "BP-Low" },
                    { value: "INCIDENT", label: "Incident" },
                    { value: "TECH_MOVE", label: "Tech Move" },
                    { value: "NOTE", label: "Note" },
                  ]}
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto px-4 py-4 min-h-0">
              {logRows.length === 0 ? (
                <div className="text-sm text-[var(--to-ink-muted)]">No entries yet.</div>
              ) : (
                <div className="grid gap-2">
                  {logRows.map((r) => {
                    const who = (r.created_by_name ?? "").trim();
                    const whoDisplay = who.length ? who : "Unknown";

                    return (
                      <div
                        key={r.dispatch_console_log_id}
                        className="rounded-xl border px-3 py-2"
                        style={{ borderColor: "var(--to-border)" }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{labelForEvent(r.event_type)}</Badge>
                          {r.capacity_delta_routes !== 0 ? <Badge>Δ {fmtDelta(r.capacity_delta_routes)}</Badge> : null}
                          <span className="text-xs text-[var(--to-ink-muted)]">
                            {new Date(r.created_at).toLocaleTimeString()} • {whoDisplay}
                          </span>
                        </div>
                        <div className="mt-1 text-sm leading-snug">{r.message}</div>
                        <div className="mt-1 text-xs text-[var(--to-ink-muted)]">{r.tech_id}</div>
                      </div>
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
        </div>
      </div>
    </PageShell>
  );
}