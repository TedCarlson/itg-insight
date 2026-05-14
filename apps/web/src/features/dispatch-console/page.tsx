// path: apps/web/src/features/dispatch-console/page.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageShell, PageHeader } from "@/components/ui/PageShell";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";

import { useOrg } from "@/state/org";
import { useSession } from "@/state/session";
import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";

import type {
  DispatchRouteOption,
  EntryType,
  EventType,
  WorkforceRow,
  WorkforceTab,
  LogRow,
} from "./lib/types";
import { EVENT_ORDER } from "./lib/labels";

import { useDispatchConsoleData } from "./hooks/useDispatchConsoleData";
import { useDispatchConsoleDraft } from "./hooks/useDispatchConsoleDraft";

import { WorkforcePanel } from "./components/WorkforcePanel";

function norm(v: unknown) {
  return String(v ?? "").trim();
}

function buildRouteOptions(rows: WorkforceRow[]): DispatchRouteOption[] {
  const byRoute = new Map<string, DispatchRouteOption>();

  for (const row of rows) {
    const routeId = norm(row.planned_route_id);
    const routeName = norm(row.planned_route_name);

    if (!routeId && !routeName) continue;

    const key = routeId || routeName;
    const existing =
      byRoute.get(key) ??
      ({
        route_id: routeId,
        route_name: routeName || routeId,
        tech_count: 0,
        tech_labels: [],
      } satisfies DispatchRouteOption);

    existing.tech_count += 1;

    const techLabel = `${norm(row.full_name) || "Tech"}${norm(row.tech_id) ? ` (${norm(row.tech_id)})` : ""}`;
    if (techLabel && existing.tech_labels.length < 3) {
      existing.tech_labels.push(techLabel);
    }

    byRoute.set(key, existing);
  }

  return Array.from(byRoute.values()).sort((a, b) => a.route_name.localeCompare(b.route_name));
}

function buildTechMoveMeta(args: {
  selectedTech: WorkforceRow;
  toRouteId: string;
  toRouteName: string;
}) {
  const fromRouteId = norm(args.selectedTech.planned_route_id) || null;
  const fromRouteName = norm(args.selectedTech.planned_route_name) || null;
  const toRouteId = norm(args.toRouteId) || null;
  const toRouteName = norm(args.toRouteName) || null;

  return {
    from_route_id: fromRouteId,
    from_route_name: fromRouteName,
    to_route_id: toRouteId,
    to_route_name: toRouteName,
    schedule_action_status: "PENDING",
    schedule_action_type: "TECH_MOVE_BASELINE_UPDATE",
  };
}

export default function DispatchConsolePage() {
  const { selectedOrgId } = useOrg();
  const { userId } = useSession();
  const toast = useToast();

  const pc_org_id = selectedOrgId;
  const [shiftDate] = useState<string>(() => todayInNY());

  const [nameQuery, setNameQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [logFilter] = useState<EventType>("ALL");

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const data = useDispatchConsoleData(toast as any);

  const {
    workforce,
    notScheduled,
    summary,
    logRows,
    logRollupRows,
    loadingWorkforce,
    loadingRollup,
    loadingNotScheduled,
    loadingLog,
    loadWorkforce,
    loadNotScheduled,
    loadLog,
    loadLogRollup,
  } = data;

  const chipsByAssignment = useMemo(() => {
    const m = new Map<string, Set<EntryType>>();

    for (const r of logRollupRows) {
      const aid = String(r.assignment_id ?? "").trim();
      if (!aid) continue;
      const set = m.get(aid) ?? new Set<EntryType>();
      set.add(r.event_type as EntryType);
      m.set(aid, set);
    }

    const out = new Map<string, EntryType[]>();
    for (const [aid, set] of m.entries()) {
      const ordered = EVENT_ORDER.filter((t) => set.has(t));
      out.set(aid, ordered);
    }
    return out;
  }, [logRollupRows]);

  const promotedAssignmentIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of notScheduled) {
      const chips = chipsByAssignment.get(row.assignment_id) ?? [];
      const hasAddIn = chips.includes("ADD_IN");
      const hasCheckIn = Boolean(String(row.checked_in_at ?? "").trim());
      if (hasAddIn || hasCheckIn) set.add(row.assignment_id);
    }
    return set;
  }, [notScheduled, chipsByAssignment]);

  const scheduledRows = useMemo(() => {
    const byId = new Map<string, WorkforceRow>();
    for (const row of workforce) byId.set(row.assignment_id, row);
    for (const row of notScheduled) {
      if (promotedAssignmentIds.has(row.assignment_id)) {
        byId.set(row.assignment_id, row);
      }
    }
    return Array.from(byId.values());
  }, [workforce, notScheduled, promotedAssignmentIds]);

  const finalNotScheduledRows = useMemo(
    () => notScheduled.filter((row) => !promotedAssignmentIds.has(row.assignment_id)),
    [notScheduled, promotedAssignmentIds]
  );

  const routeOptions = useMemo(
    () => buildRouteOptions([...scheduledRows, ...finalNotScheduledRows]),
    [scheduledRows, finalNotScheduledRows]
  );

  const selectedTech: WorkforceRow | null = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return (
      scheduledRows.find((r: WorkforceRow) => r.assignment_id === selectedAssignmentId) ??
      finalNotScheduledRows.find((r: WorkforceRow) => r.assignment_id === selectedAssignmentId) ??
      null
    );
  }, [scheduledRows, finalNotScheduledRows, selectedAssignmentId]);

  const selectedRowTab: WorkforceTab = useMemo(() => {
    if (!selectedAssignmentId) return "SCHEDULED";
    return finalNotScheduledRows.some((r: WorkforceRow) => r.assignment_id === selectedAssignmentId)
      ? "NOT_SCHEDULED"
      : "SCHEDULED";
  }, [finalNotScheduledRows, selectedAssignmentId]);

  const draft = useDispatchConsoleDraft({
    selectedTech,
    selectedAssignmentId,
    setSelectedAssignmentId,
  });

  useEffect(() => {
    if (!pc_org_id) return;
    void loadWorkforce(pc_org_id, shiftDate);
    void loadNotScheduled(pc_org_id, shiftDate);
    void loadLogRollup(pc_org_id, shiftDate);
  }, [pc_org_id, shiftDate, loadWorkforce, loadNotScheduled, loadLogRollup]);

  useEffect(() => {
    if (!pc_org_id) return;
    void loadLog(pc_org_id, shiftDate, {
      event_type: logFilter === "ALL" ? undefined : logFilter,
      assignment_id: selectedAssignmentId,
    });
  }, [pc_org_id, shiftDate, logFilter, selectedAssignmentId, loadLog]);

  const loadRefresh = useCallback(() => {
    if (!pc_org_id) return;
    void loadWorkforce(pc_org_id, shiftDate);
    void loadNotScheduled(pc_org_id, shiftDate);
    void loadLogRollup(pc_org_id, shiftDate);
    void loadLog(pc_org_id, shiftDate, {
      event_type: logFilter === "ALL" ? undefined : logFilter,
      assignment_id: selectedAssignmentId,
    });
  }, [pc_org_id, shiftDate, logFilter, selectedAssignmentId, loadWorkforce, loadNotScheduled, loadLog, loadLogRollup]);

  const submit = useCallback(async () => {
    if (!pc_org_id) return;

    const msg = String(draft.message ?? "").trim();
    if (!msg) {
      toast.push({ title: "Dispatch Console", message: "Message is required.", variant: "warning" });
      return;
    }

    if (!selectedAssignmentId || !selectedTech) {
      toast.push({ title: "Dispatch Console", message: "Select a technician row first.", variant: "warning" });
      return;
    }

    if (draft.editingLogId) {
      try {
        const res = await fetch("/api/dispatch-console/log", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dispatch_console_log_id: draft.editingLogId,
            pc_org_id,
            event_type: "NOTE",
            assignment_id: selectedAssignmentId,
            message: msg,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to save note");

        draft.cancelEdit();

        await loadLog(pc_org_id, shiftDate, {
          assignment_id: selectedAssignmentId,
        });
        await loadLogRollup(pc_org_id, shiftDate);
      } catch (e: any) {
        toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to save note", variant: "danger" });
      }
      return;
    }

    if (!draft.entryType) {
      toast.push({ title: "Dispatch Console", message: "Choose an action type first.", variant: "warning" });
      return;
    }

    if (draft.entryType === "TECH_MOVE" && !norm(draft.techMoveToRouteId)) {
      toast.push({
        title: "Dispatch Console",
        message: "Choose the destination route for this tech move.",
        variant: "warning",
      });
      return;
    }

    try {
      const techMoveMeta =
        draft.entryType === "TECH_MOVE"
          ? buildTechMoveMeta({
              selectedTech,
              toRouteId: draft.techMoveToRouteId,
              toRouteName: draft.techMoveToRouteName,
            })
          : null;

      const res = await fetch("/api/dispatch-console/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pc_org_id,
          shift_date: shiftDate,
          assignment_id: selectedAssignmentId,
          event_type: draft.entryType,
          message: msg,
          meta: {
            source: "dispatch_console_row_drawer",
            tech_id: selectedTech.tech_id ?? null,
            full_name: selectedTech.full_name ?? null,
            ...(techMoveMeta ?? {}),
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to add log entry");

      await loadWorkforce(pc_org_id, shiftDate);
      await loadNotScheduled(pc_org_id, shiftDate);
      await loadLogRollup(pc_org_id, shiftDate);
      await loadLog(pc_org_id, shiftDate, {
        assignment_id: selectedAssignmentId,
      });

      draft.clearDraft();
      draft.onSelectAssignment(selectedAssignmentId);
    } catch (e: any) {
      toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to add log entry", variant: "danger" });
    }
  }, [
    pc_org_id,
    shiftDate,
    selectedAssignmentId,
    selectedTech,
    toast,
    draft,
    loadWorkforce,
    loadNotScheduled,
    loadLog,
    loadLogRollup,
  ]);

  const deleteNote = useCallback(
    async (row: LogRow) => {
      if (!pc_org_id) return;

      try {
        const res = await fetch("/api/dispatch-console/log", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dispatch_console_log_id: row.dispatch_console_log_id,
            pc_org_id,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to delete note");

        if (draft.editingLogId === row.dispatch_console_log_id) draft.cancelEdit();

        await loadWorkforce(pc_org_id, shiftDate);
        await loadNotScheduled(pc_org_id, shiftDate);
        await loadLog(pc_org_id, shiftDate, {
          assignment_id: selectedAssignmentId,
        });
        await loadLogRollup(pc_org_id, shiftDate);
      } catch (e: any) {
        toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to delete note", variant: "danger" });
      }
    },
    [pc_org_id, shiftDate, selectedAssignmentId, toast, draft, loadWorkforce, loadNotScheduled, loadLog, loadLogRollup]
  );

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

  return (
    <PageShell>
      <PageHeader title="Dispatch Console" subtitle="Daily workforce command surface." />

      <WorkforcePanel
        panelH="min-h-[calc(100vh-220px)]"
        shiftDate={shiftDate}
        loadingWorkforce={loadingWorkforce}
        loadingRollup={loadingRollup}
        loadingNotScheduled={loadingNotScheduled}
        loadRefresh={loadRefresh}
        nameQuery={nameQuery}
        setNameQuery={setNameQuery}
        routeQuery={routeQuery}
        setRouteQuery={setRouteQuery}
        summary={summary}
        scheduledRows={scheduledRows}
        notScheduledRows={finalNotScheduledRows}
        selectedAssignmentId={selectedAssignmentId}
        onSelectAssignment={(aid) => {
          if (draft.editingLogId) return;
          draft.onSelectAssignment(aid);
        }}
        chipsByAssignment={chipsByAssignment}
        workforceTabForSelectedRow={selectedRowTab}
        selectedTech={selectedTech}
        routeOptions={routeOptions}
        entryType={draft.entryType}
        setEntryType={draft.setEntryType}
        message={draft.message}
        setMessage={draft.setMessage}
        techMoveFromRouteId={draft.techMoveFromRouteId}
        techMoveFromRouteName={draft.techMoveFromRouteName}
        techMoveToRouteId={draft.techMoveToRouteId}
        techMoveToRouteName={draft.techMoveToRouteName}
        setTechMoveDestination={draft.setTechMoveDestination}
        editing={draft.editing}
        canSubmit={draft.canSubmit}
        onSubmit={submit}
        onClearOrCancel={() => {
          if (draft.editingLogId) draft.cancelEdit();
          else draft.clearDraft();
        }}
        logRows={logRows}
        loadingLog={loadingLog}
        onRefreshSelectedHistory={() =>
          loadLog(pc_org_id, shiftDate, {
            assignment_id: selectedAssignmentId,
          })
        }
        userId={userId}
        onBeginEdit={(row) => {
          if (row.event_type !== "NOTE") return;
          draft.beginEdit(row);
        }}
        onDeleteNote={(row) => {
          if (row.event_type !== "NOTE") return;
          void deleteNote(row);
        }}
      />
    </PageShell>
  );
}