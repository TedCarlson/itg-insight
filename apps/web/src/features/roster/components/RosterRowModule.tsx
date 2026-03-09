// apps/web/src/features/roster/components/RosterRowModule.tsx
"use client";

import { useMemo, useState } from "react";
import { type RosterRow } from "@/shared/lib/api";

import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";

import { PersonTab } from "./row-module/PersonTab";
import { OrgTab } from "./row-module/OrgTab";
import { AssignmentTab } from "./row-module/AssignmentTab";
import { LeadershipTab } from "./row-module/LeadershipTab";

import { type TabKey, buildTitle } from "./rosterRowModule.helpers";

import { useRosterRowModule } from "../hooks/row-module/useRosterRowModule";
import { usePersonTab } from "../hooks/row-module/usePersonTab";
import { useAssignmentTab } from "../hooks/row-module/useAssignmentTab";
import { useOrgTab, type OrgMeta } from "../hooks/row-module/useOrgTab";
import { useLeadershipTab } from "../hooks/row-module/useLeadershipTab";

/** ---- Static component (must be outside render) ---- */
function Pill({ label, ok, title }: { label: string; ok: boolean; title: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
      style={
        ok
          ? { background: "rgba(34, 197, 94, 0.14)", color: "var(--to-status-success)" }
          : { background: "rgba(249, 115, 22, 0.16)", color: "var(--to-status-warning)" }
      }
      title={title}
      aria-label={title}
    >
      {String(label ?? "").slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Wrapper that forces a remount when:
 *  - dialog opens/closes
 *  - row changes
 * This resets state (tab, invite fields, etc.) WITHOUT a useEffect.
 */
export function RosterRowModule(props: {
  open: boolean;
  onClose: () => void;
  pcOrgId: string;
  pcOrgName?: string | null;
  row: RosterRow | null;

  // ✅ permission + modify mode (passed down from RosterPage)
  canManage?: boolean; // roster_manage OR owner
  modifyMode?: "open" | "locked";

  // ✅ org meta for the selected PC-ORG (from roster page hook)
  orgMeta?: OrgMeta | null;
}) {
  const rowKey = String(
    (props.row as any)?.person_id ?? (props.row as any)?.assignment_id ?? (props.row as any)?.tech_id ?? ""
  );
  const mountKey = `${props.open ? "open" : "closed"}:${props.pcOrgId}:${rowKey}`;

  return <RosterRowModuleInner key={mountKey} {...props} />;
}

function RosterRowModuleInner({
  open,
  onClose,
  pcOrgId,
  pcOrgName,
  row,

  canManage = false,
  modifyMode = "locked",

  orgMeta = null,
}: {
  open: boolean;
  onClose: () => void;
  pcOrgId: string;
  pcOrgName?: string | null;
  row: RosterRow | null;

  canManage?: boolean;
  modifyMode?: "open" | "locked";

  orgMeta?: OrgMeta | null;
}) {
  const [tab, setTab] = useState<TabKey>("person");

  const title = useMemo(() => buildTitle(row), [row]);

  const personId = (row as any)?.person_id ?? null;
  const assignmentId = (row as any)?.assignment_id ?? null;

  // ---------------- Hooks (brains) ----------------

  const person = usePersonTab({
    open,
    tab,
    row,
    personId: personId ? String(personId) : null,
  });

  const assignment = useAssignmentTab({
    open,
    tab,
    pcOrgId,
    personId: personId ? String(personId) : null,
    assignmentId: assignmentId ? String(assignmentId) : null,
    canManage,
    modifyMode,
  });

  const leadership = useLeadershipTab({
    open,
    pcOrgId,
    row,
    personId: personId ? String(personId) : null,
    assignmentId: assignmentId ? String(assignmentId) : null,
    master: (assignment as any).master ?? null,
    masterForPerson: (assignment as any).masterForPerson as any,
    positionTitles: (assignment as any).positionTitleOptions ?? [],
  });

  const activeAssignmentCount = useMemo(() => {
    const master = (assignment as any)?.master as any[] | null;
    if (!Array.isArray(master) || !personId) return 0;

    return master
      .filter((r) => String(r?.person_id ?? "") === String(personId))
      .filter((r) => {
        const end = String(r?.end_date ?? "").trim();
        const active = Boolean(r?.active ?? r?.assignment_active ?? r?.assignment_record_active ?? true);
        return active && !end;
      }).length;
  }, [assignment, personId]);

  const activeLeadershipCount = useMemo(() => {
    const m: any = (assignment as any)?.masterForPerson ?? null;

    const masterHasLeader =
      !!m?.reports_to_assignment_id || !!m?.reports_to_person_id || !!String(m?.reports_to_full_name ?? "").trim();

    const masterActive =
      m &&
      !String(m?.end_date ?? "").trim() &&
      Boolean(m?.active ?? m?.assignment_active ?? m?.assignment_record_active ?? true);

    if (masterHasLeader && masterActive) return 1;

    const drillForPerson = ((leadership as any)?.drillForPerson ?? []) as any[];
    if (!Array.isArray(drillForPerson)) return 0;

    return drillForPerson.filter((r) => {
      const hasLeader =
        !!r?.reports_to_assignment_id ||
        !!r?.reports_to_person_id ||
        !!String(r?.reports_to_full_name ?? "").trim() ||
        !!r?.reports_to_reporting_id ||
        !!r?.assignment_reporting_id ||
        !!r?.reporting_id;

      const end = String(r?.reports_to_end_date ?? r?.assignment_reporting_end_date ?? r?.reporting_end_date ?? "").trim();

      return hasLeader && !end;
    }).length;
  }, [assignment, leadership]);

  const endOrgBlocked =
    !canManage ||
    modifyMode === "locked" ||
    activeAssignmentCount > 0 ||
    activeLeadershipCount > 0;

  const { refreshCurrent, refreshing } = useRosterRowModule({
    tab,
    loadPerson: (person as any).loadPerson,
    loadMaster: (assignment as any).loadMaster,
    loadDrilldown: (leadership as any).loadDrilldown,
    loadingPerson: (person as any).loadingPerson,
    loadingMaster: (assignment as any).loadingMaster,
    loadingDrill: (leadership as any).loadingDrill,
  });

  // ✅ PASS orgMeta into hook so it can expose mso/div/region
  const org = useOrgTab({
    row,
    pcOrgId,
    pcOrgName: pcOrgName ?? null,
    personId: personId ? String(personId) : null,
    onClose,
    refreshCurrent,
    endOrgBlocked,
    orgMeta,
  });

  // ---------------- Pills / record status ----------------

  const personOk = !!String(((person as any).personDraft ?? (person as any).person ?? {})?.full_name ?? "").trim();

  const ended =
    (org as any)?.orgAssociationEndedAt ??
    (org as any)?.ended ??
    (row as any)?.person_pc_org_end_date ??
    (row as any)?.pc_org_end_date ??
    null;

  const orgOk = !!String(pcOrgId ?? "").trim() && !String(ended ?? "").trim();
  const assignmentOk = activeAssignmentCount > 0;
  const leadershipOk = activeLeadershipCount > 0;

  const options = useMemo(
    () => [
      { value: "person" as const, label: "Person" },
      { value: "org" as const, label: "Org" },
      { value: "leadership" as const, label: "Leadership" },
      { value: "assignment" as const, label: "Assignments" },
    ],
    []
  );

  const orgStartDate =
    (org as any)?.orgStartDate ??
    (row as any)?.pc_org_start_date ??
    (row as any)?.org_start_date ??
    (row as any)?.org_event_start_date ??
    (row as any)?.start_date ??
    null;

  const endOrgBlockedTitle = endOrgBlocked
    ? !canManage
      ? "You do not have permission to end org associations (roster_manage required)."
      : modifyMode === "locked"
        ? "Roster is locked (read-only)."
        : "End assignments and leadership first (then you can end org association)."
    : "End Org association";

  const setLeadershipDraftReportsToAssignmentId = (v: string) => {
    const anyLead: any = leadership as any;
    if (typeof anyLead.setLeadershipDraftReportsToAssignmentId === "function") {
      anyLead.setLeadershipDraftReportsToAssignmentId(v);
      return;
    }
    if (typeof anyLead.setLeadershipDraft === "function") {
      anyLead.setLeadershipDraft({ reports_to_assignment_id: v });
      return;
    }
    if (typeof anyLead.setLeadershipDraftState === "function") {
      anyLead.setLeadershipDraftState({ reports_to_assignment_id: v });
      return;
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 truncate">{title}</div>
            <div className="shrink-0 text-xs text-[var(--to-ink-muted)]">
              {pcOrgName ?? "Org"} • {String(pcOrgId).slice(0, 8)}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Pill label="P" ok={personOk} title={personOk ? "Person: set" : "Person: not set"} />
            <Pill label="O" ok={orgOk} title={orgOk ? "Org: set" : "Org: not set"} />
            <Pill label="L" ok={leadershipOk} title={leadershipOk ? "Leadership: set" : "Leadership: not set"} />
            <Pill label="A" ok={assignmentOk} title={assignmentOk ? "Assignments: set" : "Assignments: not set"} />
          </div>
        </div>
      }
      size="lg"
      footer={
        <Button variant="ghost" type="button" onClick={onClose}>
          Close
        </Button>
      }
    >
      {!row ? (
        <div className="text-sm text-[var(--to-ink-muted)]">No row selected.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SegmentedControl value={tab} onChange={setTab} options={options} />
            <div className="flex items-center gap-2">
              <Button variant="secondary" type="button" onClick={refreshCurrent} disabled={refreshing}>
                {refreshing ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          </div>

          {tab === "person" ? (
            <PersonTab
              row={row as any}
              personId={personId ? String(personId) : null}
              person={(person as any).person}
              personHuman={(person as any).personHuman}
              personErr={(person as any).personErr}
              loadingPerson={(person as any).loadingPerson}
              editingPerson={(person as any).editingPerson}
              savingPerson={(person as any).savingPerson}
              personBaseline={(person as any).personBaseline}
              personDraft={(person as any).personDraft}
              setPersonDraft={(person as any).setPersonDraft}
              beginEditPerson={(person as any).beginEditPerson}
              cancelEditPerson={(person as any).cancelEditPerson}
              savePerson={(person as any).savePerson}
              coResolved={(person as any).coResolved}
              setCoResolved={(person as any).setCoResolved}
            />
          ) : null}

          {tab === "org" ? (
            <OrgTab
              row={row}
              pcOrgName={pcOrgName}
              orgStartDate={orgStartDate}
              msoName={(org as any).msoName ?? null}
              divisionName={(org as any).divisionName ?? null}
              regionName={(org as any).regionName ?? null}
              endOrgBlocked={endOrgBlocked}
              endOrgBlockedTitle={endOrgBlockedTitle}
              endPcOrgCascade={(org as any).endPcOrgCascade}
            />
          ) : null}

          {tab === "assignment" ? (
            <AssignmentTab
              masterErr={(assignment as any).masterErr}
              assignmentErr={(assignment as any).assignmentErr}
              loadingMaster={(assignment as any).loadingMaster}
              masterForPerson={(assignment as any).masterForPerson}
              row={row as any}
              editingAssignment={(assignment as any).editingAssignment}
              savingAssignment={(assignment as any).savingAssignment}
              assignmentDraft={(assignment as any).assignmentDraft}
              assignmentDirty={(assignment as any).assignmentDirty}
              assignmentValidation={(assignment as any).assignmentValidation}
              positionTitlesError={(assignment as any).positionTitlesError}
              positionTitlesLoading={(assignment as any).positionTitlesLoading}
              positionTitleOptions={(assignment as any).positionTitleOptions}
              loadPositionTitles={(assignment as any).loadPositionTitles}
              beginEditAssignment={(assignment as any).beginEditAssignment}
              cancelEditAssignment={(assignment as any).cancelEditAssignment}
              saveAssignment={(assignment as any).saveAssignment}
              setAssignmentDraft={(assignment as any).setAssignmentDraft}
              officeOptions={(assignment as any).officeOptions}
              officeLoading={(assignment as any).officeLoading}
              officeError={(assignment as any).officeError}
              loadOffices={(assignment as any).loadOffices}
              canManage={Boolean(canManage)}
              modifyMode={(modifyMode ?? "locked") as "open" | "locked"}
            />
          ) : null}

          {tab === "leadership" ? (
            <LeadershipTab
              row={row}
              drillErr={(leadership as any).drillErr}
              leadershipErr={(leadership as any).leadershipErr}
              loadingDrill={(leadership as any).loadingDrill}
              drillForPersonLen={(((leadership as any).drillForPerson ?? []) as any[]).length}
              editingLeadership={(leadership as any).editingLeadership}
              savingLeadership={(leadership as any).savingLeadership}
              assignmentId={assignmentId ? String(assignmentId) : null}
              leadershipContext={{
                reports_to_full_name: (leadership as any)?.leadershipContext?.reports_to_full_name ?? null,
                reports_to_assignment_id: (leadership as any)?.leadershipContext?.reports_to_assignment_id
                  ? String((leadership as any).leadershipContext.reports_to_assignment_id)
                  : null,
              }}
              leadershipDraftReportsToAssignmentId={String(
                (leadership as any)?.leadershipDraft?.reports_to_assignment_id ?? ""
              )}
              managerOptions={(leadership as any).managerOptions}
              beginEditLeadership={(leadership as any).beginEditLeadership}
              cancelEditLeadership={(leadership as any).cancelEditLeadership}
              saveLeadership={(leadership as any).saveLeadership}
              setLeadershipDraftReportsToAssignmentId={setLeadershipDraftReportsToAssignmentId}
            />
          ) : null}
        </div>
      )}
    </Modal>
  );
}