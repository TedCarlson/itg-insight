// path: apps/web/src/features/role-company-manager/hooks/useScopedTeamControls.ts

import { useMemo } from "react";
import type {
  MetricsControlsValue,
  TeamRowClient,
} from "@/shared/lib/metrics/buildScopedRows";

function isCompanyLane(row: TeamRowClient): boolean {
  return String(row.affiliation_type ?? "").trim().toUpperCase() === "COMPANY";
}

function dedupeRows(rows: TeamRowClient[]): TeamRowClient[] {
  const out: TeamRowClient[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key =
      String(row.person_id ?? "").trim() ||
      String(row.tech_id ?? "").trim() ||
      row.subject_key;

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

export function useScopedTeamControls(
  rows: TeamRowClient[],
  controls: MetricsControlsValue
) {
  const firstClassRows = useMemo(() => {
    return rows.filter((row) => {
      if (controls.office_label && row.office_label !== controls.office_label) {
        return false;
      }

      if (
        controls.affiliation_type &&
        row.affiliation_type !== controls.affiliation_type
      ) {
        return false;
      }

      if (
        controls.contractor_name &&
        row.contractor_name !== controls.contractor_name
      ) {
        return false;
      }

      return true;
    });
  }, [
    rows,
    controls.office_label,
    controls.affiliation_type,
    controls.contractor_name,
  ]);

  const selectedSupervisorId = String(
    controls.reports_to_person_id ?? ""
  ).trim();

  const supervisorRows = useMemo(() => {
    if (!selectedSupervisorId) return [];

    return firstClassRows.filter(
      (row) =>
        String(row.reports_to_person_id ?? "").trim() === selectedSupervisorId
    );
  }, [firstClassRows, selectedSupervisorId]);

  const directRows = useMemo(() => {
    return supervisorRows.filter(isCompanyLane);
  }, [supervisorRows]);

  const affiliateDirectRows = useMemo(() => {
    return supervisorRows.filter((row) => !isCompanyLane(row));
  }, [supervisorRows]);

  const rollupRows = useMemo(() => {
    return dedupeRows([...directRows, ...affiliateDirectRows]);
  }, [directRows, affiliateDirectRows]);

  const hasSupervisor = Boolean(selectedSupervisorId);
  const showTeamScope = hasSupervisor && rollupRows.length > 0;

  return {
    firstClassRows,
    directRows,
    affiliateDirectRows,
    rollupRows,
    showTeamScope,
    hasDirectRows: directRows.length > 0,
    hasAffiliateDirectRows: affiliateDirectRows.length > 0,
  };
}