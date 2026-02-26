// RUN THIS
// Replace the entire file:
// apps/web/src/features/roster/pages/RosterPage.tsx

"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import type { RosterRow } from "@/shared/lib/api";
import { createClient } from "@/shared/data/supabase/client";

import { useOrg } from "@/state/org";
import { useSession } from "@/state/session";
import { useRosterManageAccess } from "@/features/roster/hooks/useRosterManageAccess";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";

import { RosterTable } from "@/features/roster/components/RosterTable";
import { RosterRowModule } from "@/features/roster/components/RosterRowModule";
import { RosterQuickView } from "@/features/roster/components/RosterQuickView";
import { RosterHeaderCards } from "@/features/roster/components/RosterHeaderCards";

import { pickName } from "@/features/roster/lib/rosterFormat";
import { useRosterPageData } from "@/features/roster/hooks/useRosterPageData";
import { useRosterFilters } from "@/features/roster/hooks/useRosterFilters";

export default function RosterPage() {
  const { selectedOrgId, orgs, orgsLoading } = useOrg();
  const toast = useToast();

  const { isOwner } = useSession();
  const { allowed: canManageRoster, loading: rosterPermLoading } = useRosterManageAccess();
  const canEditRoster = isOwner || canManageRoster;

  const [modifyMode, setModifyMode] = useState<"open" | "locked">("locked");
  const effectiveModifyMode: "open" | "locked" = canEditRoster ? modifyMode : "locked";

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickRow, setQuickRow] = useState<RosterRow | null>(null);
  const [quickPos, setQuickPos] = useState<{ top: number; left: number } | null>(null);

  const closeQuick = () => {
    setQuickOpen(false);
    setQuickRow(null);
    setQuickPos(null);
  };

  const openQuick = (row: RosterRow, anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();
    const width = 420;
    const pad = 12;
    const estHeight = 260;

    const topBelow = rect.bottom + 10;
    const top =
      typeof window !== "undefined" && topBelow + estHeight > window.innerHeight - pad
        ? Math.max(pad, rect.top - 10 - estHeight)
        : topBelow;

    const left =
      typeof window !== "undefined"
        ? Math.min(Math.max(pad, rect.left), window.innerWidth - width - pad)
        : rect.left;

    setQuickRow(row);
    setQuickPos({ top, left });
    setQuickOpen(true);
  };

  const supabase = useMemo(() => createClient(), []);

  const [selectedRow, setSelectedRow] = useState<RosterRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const validatedOrgId = useMemo(() => {
    const v = String(selectedOrgId ?? "").trim();
    return v || null;
  }, [selectedOrgId]);

  const selectedOrgName = useMemo(() => {
    if (!validatedOrgId) return null;
    const o = (orgs ?? []).find((x: any) => String(x?.pc_org_id ?? "").trim() === String(validatedOrgId));
    return (o as any)?.pc_org_name ?? (o as any)?.name ?? null;
  }, [validatedOrgId, orgs]);

  const canLoad = Boolean(validatedOrgId);

  const { loading, err, roster, orgMetaLoading, orgMeta, loadAll } = useRosterPageData({
    validatedOrgId,
    supabase,
    selectedRow,
    setSelectedRow,
    closeQuick,
    setDetailsOpen,
    setModifyModeLocked: () => setModifyMode("locked"),
  });

  const {
    roleFilter,
    setRoleFilter,
    query,
    setQuery,
    affKey,
    setAffKey,
    supervisorKey,
    setSupervisorKey,
    rosterRoleFiltered,
    affiliationOptions,
    supervisorOptions,
    filteredRoster,
    rosterStats,
    // anyFiltersActive,
    // clearFilters,
  } = useRosterFilters({ roster, validatedOrgId });

  const refreshDisabled = orgsLoading || !canLoad || loading || orgMetaLoading;

  const modifyToggleVars =
    effectiveModifyMode === "open"
      ? ({
          ["--to-toggle-active-bg" as any]: "rgba(249, 115, 22, 0.16)",
          ["--to-toggle-active-border" as any]: "var(--to-status-warning)",
          ["--to-toggle-active-ink" as any]: "var(--to-status-warning)",
        } as CSSProperties)
      : undefined;

  const addToRosterDisabled =
    !validatedOrgId ||
    orgsLoading ||
    rosterPermLoading ||
    loading ||
    orgMetaLoading ||
    !canEditRoster ||
    effectiveModifyMode !== "open";

  // toolbar sizing (nano)
  const H = "h-9";
  const FIELD = `${H} text-xs`;
  const REFRESH_SMALL = "h-8 px-2.5 text-xs rounded-full";

  const countLabel =
    roleFilter === "technician" ? "Tech" : roleFilter === "supervisor" ? "Supervisor" : "Roster";

  return (
    <PageShell>
      <RosterHeaderCards
        validatedOrgId={validatedOrgId}
        selectedOrgName={selectedOrgName}
        canEditRoster={canEditRoster}
        addToRosterDisabled={addToRosterDisabled}
        orgMetaLoading={orgMetaLoading}
        orgMeta={orgMeta}
        onAdded={() => {
          if (validatedOrgId) void loadAll(validatedOrgId);
        }}
      />

      {canLoad && err ? (
        <Notice variant="danger" title="Could not load roster">
          <div className="text-sm">{err}</div>
          <div className="mt-2 text-xs text-[var(--to-ink-muted)]">
            If this is a permission issue, you should see a hard <code>Forbidden</code> / <code>Unauthorized</code>{" "}
            error (expected behavior).
          </div>
        </Notice>
      ) : null}

      <Card>
        <div className="mb-3 flex flex-col gap-2">
          {/* Top toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-2 rounded-full border border-[var(--to-border)] px-2 ${H}`}>
              <span className="text-xs text-[var(--to-ink-muted)]">Modify</span>
              <span style={modifyToggleVars}>
                <SegmentedControl
                  value={effectiveModifyMode}
                  onChange={(v) => {
                    if (!canEditRoster) {
                      toast.push({
                        title: "Permission required",
                        message: "You need roster_manage to unlock modify mode.",
                        variant: "warning",
                      });
                      return;
                    }
                    setModifyMode(v as "open" | "locked");
                  }}
                  options={[
                    { value: "locked", label: "Locked" },
                    { value: "open", label: "Open" },
                  ]}
                  size="sm"
                  className={!canEditRoster ? "opacity-60" : undefined}
                />
              </span>
            </div>

            <span className="px-1 text-[var(--to-ink-muted)]">•</span>

            <div className={`flex items-center rounded-full ${H}`}>
              <SegmentedControl
                value={roleFilter}
                onChange={(v) => setRoleFilter(v as any)}
                options={[
                  { value: "technician", label: "Technician" },
                  { value: "supervisor", label: "Supervisor" },
                  { value: "all", label: "All" },
                ]}
                size="sm"
              />
            </div>

            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search (tech id, name, mobile, nt login, csg, affiliation)…"
              className={`w-full sm:w-80 ${FIELD}`}
            />

            <Select
              value={affKey}
              onChange={(e) => setAffKey(e.target.value)}
              className={`w-full sm:w-80 ${FIELD}`}
              disabled={affiliationOptions.length === 0}
            >
              <option value="all">All affiliations</option>
              {affiliationOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>

            <Select
              value={supervisorKey}
              onChange={(e) => setSupervisorKey(e.target.value)}
              className={`w-full sm:w-80 ${FIELD}`}
              disabled={supervisorOptions.length === 0}
            >
              <option value="all">All supervisors</option>
              {supervisorOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Stats row with inline Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-y-1 text-sm">
              <span className="font-medium">
                {countLabel} Count: {rosterStats.totalTechs}
              </span>
              <span className="mx-2 inline-block text-muted-foreground">&nbsp;•&nbsp;</span>
              <span>
                ITG: <span className="font-medium">{rosterStats.itgTechs}</span> (
                {rosterStats.totalTechs === 0 ? "0.0" : ((rosterStats.itgTechs / rosterStats.totalTechs) * 100).toFixed(1)}
                %)
              </span>
              <span className="mx-2 inline-block text-muted-foreground">&nbsp;•&nbsp;</span>
              <span>
                BP: <span className="font-medium">{rosterStats.bpTechs}</span> (
                {rosterStats.totalTechs === 0 ? "0.0" : ((rosterStats.bpTechs / rosterStats.totalTechs) * 100).toFixed(1)}
                %)
              </span>
            </div>

            <Button
              variant="secondary"
              type="button"
              onClick={() => validatedOrgId && void loadAll(validatedOrgId)}
              disabled={refreshDisabled}
              className={REFRESH_SMALL}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>

        {orgsLoading ? (
          <div className="text-sm text-[var(--to-ink-muted)]">Loading organizations…</div>
        ) : !canLoad ? (
          <EmptyState
            title={orgs.length ? "Select an organization" : "No organizations available"}
            message={
              orgs.length
                ? "Choose an org in the header to load the roster."
                : "This user has no org access. Ask an owner/admin to grant access or add membership."
            }
            compact
          />
        ) : loading ? (
          <div className="text-sm text-[var(--to-ink-muted)]">Loading roster…</div>
        ) : filteredRoster.length === 0 ? (
          <EmptyState
            title={rosterRoleFiltered.length ? "No matches" : "No roster entries"}
            message={
              rosterRoleFiltered.length
                ? "Try clearing filters or changing your search."
                : "This org has no roster rows returned from the API (or you don’t have access)."
            }
            compact
          />
        ) : (
          <RosterTable
            roster={filteredRoster}
            pickName={pickName}
            modifyMode={modifyMode}
            onRowOpen={(row) => {
              closeQuick();
              setSelectedRow(row);
              setDetailsOpen(true);
            }}
            onRowQuickView={(row, el) => {
              setSelectedRow(row);
              setDetailsOpen(false);
              openQuick(row, el);
            }}
          />
        )}

        {canLoad && !loading ? (
          <div className="mt-3 text-xs text-[var(--to-ink-muted)]">
            Showing <span className="text-[var(--to-ink)]">{filteredRoster.length}</span> rows
            {roleFilter !== "all" ? (
              <>
                {" "}
                (<span className="text-[var(--to-ink)]">{roleFilter}</span>)
              </>
            ) : null}
            {query.trim() ? (
              <>
                {" "}
                • filtered by “<span className="text-[var(--to-ink)]">{query.trim()}</span>”
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      <RosterQuickView open={quickOpen} row={quickRow} pos={quickPos} onClose={closeQuick} toastPush={toast.push} />

      {validatedOrgId ? (
        <RosterRowModule
          open={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            if (validatedOrgId) void loadAll(validatedOrgId);
          }}
          pcOrgId={validatedOrgId}
          pcOrgName={selectedOrgName}
          row={selectedRow}
          canManage={canEditRoster}
          modifyMode={modifyMode}
          orgMeta={orgMeta ?? null}
        />
      ) : null}
    </PageShell>
  );
}