"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

import { useOrg } from "@/state/org";
import { useDispatchConsoleAccess } from "@/hooks/useDispatchConsoleAccess";

type EventType = "CALL_OUT" | "ADD_IN" | "INCIDENT" | "NOTE";
type FilterType = "ALL" | EventType;

type TechRow = {
  assignment_id: string;
  person_id?: string | null;
  tech_id?: string | null;
  full_name?: string | null;
  co_name?: string | null;

  // Future: schedule/SV/check-in
  route_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  sv_built?: boolean | null;
};

type LogRow = {
  dispatch_console_log_id: string;
  shift_date: string;
  assignment_id: string;
  person_id: string;
  tech_id: string;
  affiliation_id: string | null;
  event_type: EventType;
  capacity_delta_routes: number;
  message: string;
  created_at: string;
  created_by_user_id: string;
};

function cls(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

function todayNyIsoDate(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function deltaFor(t: EventType): number {
  if (t === "CALL_OUT") return -1;
  if (t === "ADD_IN") return 1;
  return 0;
}

function labelForTech(t: TechRow): string {
  const tech = String(t.tech_id ?? "").trim();
  const name = String(t.full_name ?? "").trim();
  const co = String(t.co_name ?? "").trim();
  const left = [tech, name].filter(Boolean).join(" — ");
  return co ? `${left} (${co})` : left || t.assignment_id;
}

export default function DispatchConsolePage() {
  const { selectedOrgId } = useOrg();
  const { loading: accessLoading, allowed: accessAllowed } = useDispatchConsoleAccess();

  const pcOrgId = String(selectedOrgId ?? "").trim();
  const scoped = Boolean(pcOrgId);

  // Today only (NY). Historical later.
  const [shiftDate] = useState<string>(() => todayNyIsoDate());

  const canShowSurface = scoped && accessAllowed;

  // Workforce (placeholder: roster techs)
  const [svAsOf] = useState<string>("—");
  const [workforceSearch, setWorkforceSearch] = useState<string>("");
  const [techsLoading, setTechsLoading] = useState(false);
  const [techsError, setTechsError] = useState<string | null>(null);
  const [techs, setTechs] = useState<TechRow[]>([]);

  // Selected tech anchor
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const selectedTech = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return techs.find((t) => String(t.assignment_id) === String(selectedAssignmentId)) ?? null;
  }, [selectedAssignmentId, techs]);

  // Composer
  const [techIdLookup, setTechIdLookup] = useState<string>("");
  const [eventType, setEventType] = useState<EventType>("NOTE");
  const [message, setMessage] = useState<string>("");

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Log history
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logRows, setLogRows] = useState<LogRow[]>([]);

  // Enforce NOTE-only if no tech selected
  useEffect(() => {
    if (!selectedTech && eventType !== "NOTE") setEventType("NOTE");
  }, [selectedTech, eventType]);

  async function loadTechs() {
    if (!scoped || !accessAllowed) return;

    setTechsLoading(true);
    setTechsError(null);

    try {
      const res = await fetch(`/api/dispatch-console/techs?pc_org_id=${encodeURIComponent(pcOrgId)}`, {
        method: "GET",
        headers: { "content-type": "application/json" },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Workforce load failed (${res.status})`);

      setTechs((json?.techs ?? []) as TechRow[]);
    } catch (e: any) {
      setTechs([]);
      setTechsError(e?.message ?? "Unknown error");
    } finally {
      setTechsLoading(false);
    }
  }

  async function loadLog() {
    if (!scoped || !accessAllowed) return;

    setLogLoading(true);
    setLogError(null);

    try {
      const url = `/api/dispatch-console/log?pc_org_id=${encodeURIComponent(pcOrgId)}&shift_date=${encodeURIComponent(
        shiftDate
      )}`;

      const res = await fetch(url, { method: "GET", headers: { "content-type": "application/json" } });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error ?? `Log load failed (${res.status})`);
      setLogRows((json?.rows ?? []) as LogRow[]);
    } catch (e: any) {
      setLogRows([]);
      setLogError(e?.message ?? "Unknown error");
    } finally {
      setLogLoading(false);
    }
  }

  useEffect(() => {
    if (!scoped || !accessAllowed) return;
    loadTechs();
    loadLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcOrgId, scoped, accessAllowed]);

  function onSelectTech(assignmentId: string) {
    setSelectedAssignmentId(assignmentId);
    setSubmitError(null);
  }

  function onLookupTechId() {
    setSubmitError(null);
    const q = techIdLookup.trim();
    if (!q) return;

    const found = techs.find((t) => String(t.tech_id ?? "").trim().toUpperCase() === q.toUpperCase());
    if (found) {
      setSelectedAssignmentId(found.assignment_id);
      return;
    }

    setSubmitError(`Tech ID "${q}" not found in roster list for this PC.`);
  }

  const workforceFiltered = useMemo(() => {
    const q = workforceSearch.trim().toLowerCase();
    if (!q) return techs;

    return techs.filter((t) => {
      const s = `${t.tech_id ?? ""} ${t.full_name ?? ""} ${t.co_name ?? ""}`.toLowerCase();
      return s.includes(q);
    });
  }, [techs, workforceSearch]);

  const logFiltered = useMemo(() => {
    let rows = logRows;

    if (typeFilter !== "ALL") rows = rows.filter((r) => r.event_type === typeFilter);
    if (selectedTech) rows = rows.filter((r) => r.assignment_id === selectedTech.assignment_id);

    return rows.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [logRows, typeFilter, selectedTech]);

  async function onSubmit() {
    setSubmitError(null);

    const msg = message.trim();
    if (!msg) {
      setSubmitError("Message is required");
      return;
    }

    const assignment_id = selectedTech?.assignment_id ?? null;
    if (!assignment_id) {
      setSubmitError("Select a technician (tech-anchored log required).");
      return;
    }

    setSubmitLoading(true);

    try {
      const res = await fetch(`/api/dispatch-console/log`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pc_org_id: pcOrgId,
          shift_date: shiftDate,
          assignment_id,
          event_type: eventType,
          message: msg,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Submit failed (${res.status})`);

      setMessage("");
      await loadLog();
    } catch (e: any) {
      setSubmitError(e?.message ?? "Unknown error");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <PageShell>
      <PageHeader title="Dispatch Console" subtitle="Dispatch-first view • check-in tells the final story" />

      {!scoped ? (
        <Card>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Select a <span className="font-medium">PC</span> in the header to unlock the Dispatch Console.
          </p>
        </Card>
      ) : accessLoading ? (
        <Card>
          <p className="text-sm text-[var(--to-ink-muted)]">Checking access…</p>
        </Card>
      ) : !accessAllowed ? (
        <Card>
          <p className="text-sm text-[var(--to-danger)]">Forbidden (requires Owner, ITG Supervisor+, or BP Supervisor+)</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT: workforce */}
        <Card className="lg:col-span-5">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Dispatch workforce</div>
                <div className="text-xs text-[var(--to-ink-muted)]">Schedule + built (SV) surface (SV wiring later)</div>
              </div>
              <div className="text-xs text-[var(--to-ink-muted)]">
                Shift Validation as-of: <span className="font-medium">{svAsOf}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Search">
                <TextInput
                  value={workforceSearch}
                  onChange={(e) => setWorkforceSearch(e.target.value)}
                  placeholder="tech id / name / company…"
                  disabled={!canShowSurface}
                />
              </Field>
              <div className="sm:ml-auto">
                <Button type="button" variant="secondary" onClick={loadTechs} disabled={!canShowSurface || techsLoading}>
                  {techsLoading ? "Loading…" : "Refresh"}
                </Button>
              </div>
            </div>

            {techsError ? <p className="text-sm text-[var(--to-danger)]">{techsError}</p> : null}
            {!techsLoading && workforceFiltered.length === 0 ? (
              <p className="text-sm text-[var(--to-ink-muted)]">No workforce rows yet for this PC.</p>
            ) : null}

            <div className="max-h-[560px] overflow-auto rounded-lg border border-[var(--to-border)]">
              {workforceFiltered.map((t) => {
                const active = selectedAssignmentId === t.assignment_id;
                const route = t.route_name ?? "—";
                const hours = t.start_time && t.end_time ? `${t.start_time}–${t.end_time}` : "—";
                const built = t.sv_built == null ? "—" : t.sv_built ? "Built" : "Not built";

                return (
                  <button
                    key={t.assignment_id}
                    type="button"
                    onClick={() => onSelectTech(t.assignment_id)}
                    className={cls(
                      "w-full text-left px-3 py-2 border-b border-[var(--to-border)]",
                      "hover:bg-[var(--to-bg-subtle)]",
                      active && "bg-[var(--to-bg-subtle)]"
                    )}
                    disabled={!canShowSurface}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{labelForTech(t)}</div>
                      {active ? <Badge>Selected</Badge> : null}
                    </div>

                    <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-[var(--to-ink-muted)]">
                      <div title="Built route (from SV later)">Route: {route}</div>
                      <div title="Planned hours (schedule later)">Hours: {hours}</div>
                      <div title="Built status (from SV later)">{built}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* RIGHT */}
        <div className="lg:col-span-7 space-y-4">
          {/* Log entry */}
          <Card>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Log entry</div>
                <div
                  className="text-xs rounded-full border border-[var(--to-border)] px-2 py-1 text-[var(--to-ink-muted)]"
                  title="Capacity delta for the selected event type"
                >
                  Δ {deltaFor(eventType) > 0 ? "+" : ""}
                  {deltaFor(eventType)}
                </div>
              </div>

              {/* Only show an "active tech" pill when selected (no redundant Selected: label) */}
              {selectedTech ? (
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-white text-sm"
                    style={{ background: "var(--to-primary)" }}
                    title={labelForTech(selectedTech)}
                  >
                    {String(selectedTech.tech_id ?? "").trim() || "Selected"}
                  </span>
                  <span className="text-xs text-[var(--to-ink-muted)] truncate" title={labelForTech(selectedTech)}>
                    {String(selectedTech.full_name ?? "").trim()}
                  </span>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <SegmentedControl<EventType>
                  value={eventType}
                  onChange={(next) => {
                    if (!selectedTech && next !== "NOTE") return;
                    setEventType(next);
                  }}
                  options={[
                    { value: "CALL_OUT", label: "Call Out" },
                    { value: "ADD_IN", label: "Add In" },
                    { value: "INCIDENT", label: "Incident" },
                    { value: "NOTE", label: "Note" },
                  ]}
                />

                <div className="flex gap-2">
                  <TextInput
                    value={techIdLookup}
                    onChange={(e) => setTechIdLookup(e.target.value)}
                    placeholder="Tech ID…"
                    disabled={!canShowSurface}
                  />
                  <Button type="button" variant="secondary" onClick={onLookupTechId} disabled={!canShowSurface || !techIdLookup.trim()}>
                    Find
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <TextInput value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message…" disabled={!canShowSurface} />
                <Button type="button" onClick={onSubmit} disabled={!canShowSurface || submitLoading || !message.trim()}>
                  {submitLoading ? "…" : "Submit"}
                </Button>
              </div>

              {submitError ? <p className="text-sm text-[var(--to-danger)]">{submitError}</p> : null}
            </div>
          </Card>

          {/* Log history */}
          <Card>
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">Log history</div>
                  <Badge>{shiftDate}</Badge>
                  {selectedTech ? (
                    <span className="text-xs text-[var(--to-ink-muted)]">• {String(selectedTech.tech_id ?? "").trim() || "tech"} selected</span>
                  ) : (
                    <span className="text-xs text-[var(--to-ink-muted)]">• day-wide</span>
                  )}
                </div>

                <Button type="button" variant="secondary" onClick={loadLog} disabled={!canShowSurface || logLoading}>
                  {logLoading ? "Loading…" : "Refresh"}
                </Button>
              </div>

              <SegmentedControl<FilterType>
                value={typeFilter}
                onChange={(next) => setTypeFilter(next)}
                options={[
                  { value: "ALL", label: "All" },
                  { value: "CALL_OUT", label: "Call Out" },
                  { value: "ADD_IN", label: "Add In" },
                  { value: "INCIDENT", label: "Incident" },
                  { value: "NOTE", label: "Note" },
                ]}
              />

              {logError ? <p className="text-sm text-[var(--to-danger)]">{logError}</p> : null}
              {!logLoading && logFiltered.length === 0 ? <p className="text-sm text-[var(--to-ink-muted)]">No entries yet.</p> : null}

              <div className="space-y-2">
                {logFiltered.map((r) => (
                  <div key={r.dispatch_console_log_id} className="rounded-md bg-[var(--to-bg-subtle)] p-2">
                    <div className="flex items-center gap-2">
                      <Badge>{r.event_type}</Badge>
                      {r.capacity_delta_routes !== 0 ? (
                        <Badge variant="info">
                          {r.capacity_delta_routes > 0 ? "+" : ""}
                          {r.capacity_delta_routes}
                        </Badge>
                      ) : null}
                      <div className="ml-auto text-xs text-[var(--to-ink-muted)]">
                        {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{r.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}