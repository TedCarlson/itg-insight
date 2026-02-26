// RUN THIS
// Replace the entire file:
// apps/web/src/features/roster/hooks/useRosterFilters.ts

// apps/web/src/features/roster/hooks/useRosterFilters.ts
"use client";

import { useMemo, useState } from "react";
import type { RosterRow } from "@/shared/lib/api";
import { pickName } from "@/features/roster/lib/rosterFormat";

type RoleFilter = "technician" | "supervisor" | "all";

const DEFAULT_ROLE_FILTER: RoleFilter = "technician";

function roleText(r: any): string {
  return String(r?.position_title ?? r?.title ?? r?.role_title ?? "").trim();
}

function isSupervisorRow(r: any): boolean {
  return /supervisor/i.test(roleText(r));
}

function isTechnicianRow(r: any): boolean {
  const t = roleText(r);
  if (/technician/i.test(t)) return true;
  return Boolean(String(r?.tech_id ?? "").trim()) && !isSupervisorRow(r);
}

function supervisorKeyForRow(r: any): string | null {
  const pid = String(r?.reports_to_person_id ?? "").trim();
  if (pid) return `p:${pid}`;

  const aid = String(r?.reports_to_assignment_id ?? "").trim();
  if (aid) return `a:${aid}`;

  const name = String(r?.reports_to_full_name ?? "").trim();
  if (name) return `n:${name}`;

  return null;
}

function supervisorNameForRow(r: any): string | null {
  const name = String(r?.reports_to_full_name ?? "").trim();
  return name || null;
}

export function useRosterFilters(args: { roster: RosterRow[]; validatedOrgId: string | null }) {
  const { roster, validatedOrgId } = args;

  const [roleFilter, setRoleFilter] = useState<RoleFilter>(DEFAULT_ROLE_FILTER);
  const [query, setQuery] = useState("");
  const [affKey, setAffKey] = useState("all");
  const [supervisorKey, setSupervisorKey] = useState("all");

  // Scope rows to the org (but do NOT tie supervisor options to roleFilter)
  const rosterOrgScoped = useMemo(() => {
    const rows = (roster ?? []).slice();
    if (!validatedOrgId) return rows;

    return rows.filter((r: any) => {
      const orgId = String(r?.pc_org_id ?? "").trim();
      return !orgId || orgId === String(validatedOrgId);
    });
  }, [roster, validatedOrgId]);

  const rosterRoleFiltered = useMemo(() => {
    const rows = (rosterOrgScoped ?? []).slice();
    if (roleFilter === "all") return rows;
    if (roleFilter === "technician") return rows.filter(isTechnicianRow);
    if (roleFilter === "supervisor") return rows.filter(isSupervisorRow);
    return rows;
  }, [rosterOrgScoped, roleFilter]);

  const affiliationOptions = useMemo(() => {
    const rows = rosterRoleFiltered ?? [];
    const map = new Map<string, { type: string; name: string; label: string }>();

    for (const r of rows as any[]) {
      const type = String(r?.co_type ?? "").trim();
      const name = String(r?.co_name ?? "").trim();
      if (!type || !name) continue;

      const key = `${type}::${name}`;
      if (map.has(key)) continue;

      const label = type === "company" ? `ITG • ${name}` : `BP • ${name}`;
      map.set(key, { type, name, label });
    }

    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [rosterRoleFiltered]);

  // ✅ Supervisor dropdown should be independent of roleFilter
  const supervisorOptions = useMemo(() => {
    const rows = rosterOrgScoped ?? [];
    const map = new Map<string, string>();

    for (const r of rows as any[]) {
      const key = supervisorKeyForRow(r);
      const name = supervisorNameForRow(r);
      if (!key || !name) continue;

      if (!map.has(key)) map.set(key, name);
    }

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [rosterOrgScoped]);

  // effective keys
  const effAffKey = useMemo(() => {
    if (affKey === "all") return "all";
    return affiliationOptions.some((o) => o.key === affKey) ? affKey : "all";
  }, [affKey, affiliationOptions]);

  const effSupervisorKey = useMemo(() => {
    if (supervisorKey === "all") return "all";
    return supervisorOptions.some((o) => o.id === supervisorKey) ? supervisorKey : "all";
  }, [supervisorKey, supervisorOptions]);

  const filteredRoster = useMemo(() => {
    const rows = (rosterRoleFiltered ?? []).slice();
    const q = query.trim().toLowerCase();

    const matchesSearch = (r: any) => {
      if (!q) return true;
      const hay = [
        r?.tech_id,
        r?.full_name ?? pickName(r),
        r?.mobile,
        r?.person_nt_login,
        r?.person_csg_id,
        r?.co_name,
        roleText(r),
        r?.reports_to_full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    };

    const matchesAff = (r: any) => {
      if (effAffKey === "all") return true;
      const [type, name] = String(effAffKey).split("::");
      return String(r?.co_type ?? "") === type && String(r?.co_name ?? "") === name;
    };

    const matchesSupervisor = (r: any) => {
      if (effSupervisorKey === "all") return true;
      const rowKey = supervisorKeyForRow(r);
      return rowKey === effSupervisorKey;
    };

    const out = rows.filter((r: any) => matchesAff(r) && matchesSearch(r) && matchesSupervisor(r));

    out.sort((a: any, b: any) => {
      const aTech = String(a?.tech_id ?? "");
      const bTech = String(b?.tech_id ?? "");
      const techCmp = aTech.localeCompare(bTech, undefined, { numeric: true, sensitivity: "base" });
      if (techCmp !== 0) return techCmp;

      const aName = String(a?.full_name ?? pickName(a) ?? "");
      const bName = String(b?.full_name ?? pickName(b) ?? "");
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    });

    return out;
  }, [rosterRoleFiltered, query, effAffKey, effSupervisorKey]);

  const rosterStats = useMemo(() => {
    const techRows = filteredRoster ?? [];
    const totalTechs = techRows.length;

    const itgTechs = techRows.filter((r: any) => String(r?.co_type ?? "").trim() === "company").length;
    const bpTechs = techRows.filter((r: any) => String(r?.co_type ?? "").trim() === "contractor").length;

    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

    return {
      totalTechs,
      itgTechs,
      bpTechs,
      techPctITG: pct(itgTechs, totalTechs),
      techPctBP: pct(bpTechs, totalTechs),
    };
  }, [filteredRoster]);

  const anyFiltersActive =
    Boolean(query.trim()) ||
    roleFilter !== DEFAULT_ROLE_FILTER ||
    effAffKey !== "all" ||
    effSupervisorKey !== "all";

  const clearFilters = () => {
    setQuery("");
    setRoleFilter(DEFAULT_ROLE_FILTER);
    setAffKey("all");
    setSupervisorKey("all");
  };

  return {
    roleFilter,
    setRoleFilter,
    query,
    setQuery,

    affKey: effAffKey,
    setAffKey,
    supervisorKey: effSupervisorKey,
    setSupervisorKey,

    rosterRoleFiltered,
    affiliationOptions,
    supervisorOptions,
    filteredRoster,
    rosterStats,
    anyFiltersActive,
    clearFilters,
  };
}