// path: apps/web/src/features/role-bp-supervisor/hooks/useBpSupervisorTeamControls.ts

"use client";

import { useMemo } from "react";
import type {
  MetricsControlsValue,
  TeamRowClient,
} from "@/shared/lib/metrics/buildScopedRows";

export function useBpSupervisorTeamControls(
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

  const directRows = useMemo(() => {
    if (!selectedSupervisorId) return [];

    return firstClassRows.filter(
      (row) =>
        String(row.reports_to_person_id ?? "").trim() === selectedSupervisorId
    );
  }, [firstClassRows, selectedSupervisorId]);

  const hasSupervisor = Boolean(selectedSupervisorId);
  const hasDirectReports = directRows.length > 0;
  const showTeamScope = hasSupervisor && hasDirectReports;

  return {
    firstClassRows,
    directRows,
    showTeamScope,
    hasDirectReports,
  };
}