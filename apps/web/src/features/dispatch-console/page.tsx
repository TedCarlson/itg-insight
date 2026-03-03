// RUN THIS
// Replace the entire file:
// apps/web/src/features/dispatch-console/page.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageShell, PageHeader } from "@/components/ui/PageShell";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";

import { useOrg } from "@/state/org";
import { useSession } from "@/state/session";
import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";

import type { EntryType, EventType, WorkforceRow, WorkforceTab, LogRow } from "./lib/types";
import { EVENT_ORDER } from "./lib/labels";

import { useDispatchConsoleData } from "./hooks/useDispatchConsoleData";
import { useDispatchConsoleDraft } from "./hooks/useDispatchConsoleDraft";

import { WorkforcePanel } from "./components/WorkforcePanel";
import { EntryBar } from "./components/EntryBar";
import { DayLogPanel } from "./components/DayLogPanel";

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function DispatchConsolePage() {
  const { selectedOrgId } = useOrg();
  const { userId } = useSession();
  const toast = useToast();

  const pc_org_id = selectedOrgId;
  const [shiftDate] = useState<string>(() => todayInNY());

  const [workforceTab, setWorkforceTab] = useState<WorkforceTab>("SCHEDULED");
  const [nameQuery, setNameQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [logFilter, setLogFilter] = useState<EventType>("ALL");

  // Create-mode selection (page-owned; used for workforce highlight + history filter)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Data hook
  const data = useDispatchConsoleData(toast as any);

  // Destructure to satisfy exhaustive-deps cleanly (avoid depending on entire `data` object)
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

  const displayedWorkforce = useMemo(
    () => (workforceTab === "SCHEDULED" ? workforce : notScheduled),
    [workforceTab, workforce, notScheduled]
  );

  const selectedTech: WorkforceRow | null = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return displayedWorkforce.find((r) => r.assignment_id === selectedAssignmentId) ?? null;
  }, [displayedWorkforce, selectedAssignmentId]);

  const draft = useDispatchConsoleDraft({
    selectedTech,
    initialEntryType: "NOTE",
    selectedAssignmentId,
    setSelectedAssignmentId,
  } as any);

  // Auto-draft on tech context change (create-mode only; edit isolated inside hook)
  useEffect(() => {
    draft.onSelectedTechContext?.();
  }, [draft, selectedTech?.assignment_id, selectedTech?.planned_route_id, selectedTech?.planned_route_name]);

  // Initial loads (org/date)
  useEffect(() => {
    if (!pc_org_id) return;
    void loadWorkforce(pc_org_id, shiftDate);
    void loadLogRollup(pc_org_id, shiftDate);
  }, [pc_org_id, shiftDate, loadWorkforce, loadLogRollup]);

  // Lazy not-scheduled
  useEffect(() => {
    if (!pc_org_id) return;
    if (workforceTab !== "NOT_SCHEDULED") return;
    void loadNotScheduled(pc_org_id, shiftDate);
  }, [pc_org_id, shiftDate, workforceTab, loadNotScheduled]);

  // History load (filter + selection)
  useEffect(() => {
    if (!pc_org_id) return;
    void loadLog(pc_org_id, shiftDate, {
      event_type: logFilter === "ALL" ? undefined : logFilter,
      assignment_id: selectedAssignmentId,
    });
  }, [pc_org_id, shiftDate, logFilter, selectedAssignmentId, loadLog]);

  const panelH = "lg:h-[calc(100vh-220px)]";

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

  const loadRefresh = useCallback(() => {
    if (!pc_org_id) return;
    void loadWorkforce(pc_org_id, shiftDate);
    void loadLogRollup(pc_org_id, shiftDate);
    if (workforceTab === "NOT_SCHEDULED") void loadNotScheduled(pc_org_id, shiftDate);
    void loadLog(pc_org_id, shiftDate, {
      event_type: logFilter === "ALL" ? undefined : logFilter,
      assignment_id: selectedAssignmentId,
    });
  }, [
    pc_org_id,
    shiftDate,
    workforceTab,
    logFilter,
    selectedAssignmentId,
    loadWorkforce,
    loadNotScheduled,
    loadLog,
    loadLogRollup,
  ]);

  const submit = useCallback(async () => {
    if (!pc_org_id) return;

    const msg = String(draft.message ?? "").trim();
    if (!msg) {
      toast.push({ title: "Dispatch Console", message: "Message is required.", variant: "warning" });
      return;
    }

    // EDIT MODE: NOTE-only edits (message-only)
    if (draft.editingLogId) {
      try {
        const res = await fetch("/api/dispatch-console/log", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dispatch_console_log_id: draft.editingLogId,
            pc_org_id,
            event_type: "NOTE",
            assignment_id: draft.effectiveAssignmentId ?? null,
            message: msg,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to save note");

        draft.cancelEdit();

        await loadLog(pc_org_id, shiftDate, {
          event_type: logFilter === "ALL" ? undefined : logFilter,
          assignment_id: selectedAssignmentId,
        });
        await loadLogRollup(pc_org_id, shiftDate);
      } catch (e: any) {
        toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to save note", variant: "danger" });
      }
      return;
    }

    // CREATE MODE
    if (draft.entryType !== "NOTE" && !draft.effectiveAssignmentId) {
      toast.push({ title: "Dispatch Console", message: "Select a technician first.", variant: "warning" });
      return;
    }

    try {
      const res = await fetch("/api/dispatch-console/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pc_org_id,
          shift_date: shiftDate,
          assignment_id: draft.entryType === "NOTE" ? (draft.effectiveAssignmentId ?? null) : draft.effectiveAssignmentId,
          event_type: draft.entryType,
          message: msg,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to add log entry");

      draft.clearDraft();

      await loadWorkforce(pc_org_id, shiftDate);
      if (workforceTab === "NOT_SCHEDULED") await loadNotScheduled(pc_org_id, shiftDate);

      await loadLog(pc_org_id, shiftDate, {
        event_type: logFilter === "ALL" ? undefined : logFilter,
        assignment_id: selectedAssignmentId,
      });
      await loadLogRollup(pc_org_id, shiftDate);
    } catch (e: any) {
      toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to add log entry", variant: "danger" });
    }
  }, [
    pc_org_id,
    shiftDate,
    workforceTab,
    logFilter,
    selectedAssignmentId,
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

        await loadLog(pc_org_id, shiftDate, {
          event_type: logFilter === "ALL" ? undefined : logFilter,
          assignment_id: selectedAssignmentId,
        });
        await loadLogRollup(pc_org_id, shiftDate);
      } catch (e: any) {
        toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to delete note", variant: "danger" });
      }
    },
    [pc_org_id, shiftDate, logFilter, selectedAssignmentId, toast, draft, loadLog, loadLogRollup]
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
      <PageHeader title="Dispatch Console" subtitle="Daily workforce + immutable dispatch chronicle." />

      <div className="grid gap-4 lg:grid-cols-12">
        <WorkforcePanel
          panelH={panelH}
          shiftDate={shiftDate}
          workforceTab={workforceTab}
          setWorkforceTab={(v) => {
            setWorkforceTab(v);
            // create-only selection — clear highlight; do not touch edit mode
            setSelectedAssignmentId(null);
          }}
          loadingWorkforce={loadingWorkforce}
          loadingRollup={loadingRollup}
          loadingNotScheduled={loadingNotScheduled}
          loadRefresh={loadRefresh}
          nameQuery={nameQuery}
          setNameQuery={setNameQuery}
          routeQuery={routeQuery}
          setRouteQuery={setRouteQuery}
          summary={summary}
          displayedWorkforce={displayedWorkforce}
          selectedAssignmentId={selectedAssignmentId}
          onSelectAssignment={(aid) => {
            if (draft.editingLogId) return; // edit isolated
            setSelectedAssignmentId(aid);
          }}
          chipsByAssignment={chipsByAssignment}
        />

        <div className={cls("lg:col-span-6 grid gap-4", panelH)}>
          <EntryBar
            workforceTab={workforceTab}
            entryType={draft.entryType}
            setEntryType={draft.setEntryType}
            message={draft.message}
            setMessage={draft.setMessage}
            editing={draft.editing}
            canSubmit={draft.canSubmit}
            onSubmit={submit}
            onClearOrCancel={() => {
              if (draft.editingLogId) draft.cancelEdit();
              else draft.clearDraft();
            }}
          />

          <DayLogPanel
            panelH={panelH}
            shiftDate={shiftDate}
            logFilter={logFilter}
            setLogFilter={setLogFilter}
            loadingLog={loadingLog}
            onRefresh={() =>
              loadLog(pc_org_id, shiftDate, {
                event_type: logFilter === "ALL" ? undefined : logFilter,
                assignment_id: selectedAssignmentId,
              })
            }
            logRows={logRows}
            userId={userId}
            onBeginEdit={(row) => {
              if (row.event_type !== "NOTE") return; // guardrail
              draft.beginEdit(row);
            }}
            onDeleteNote={(row) => {
              if (row.event_type !== "NOTE") return; // guardrail
              void deleteNote(row);
            }}
          />
        </div>
      </div>
    </PageShell>
  );
}