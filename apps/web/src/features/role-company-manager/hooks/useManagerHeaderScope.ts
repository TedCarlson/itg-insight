// path: apps/web/src/features/role-company-manager/hooks/useManagerHeaderScope.ts

"use client";

import { useMemo } from "react";

import type { MetricsControlsValue, TeamRowClient } from "@/shared/lib/metrics/buildScopedRows";
import type { MetricsSmartHeaderModel } from "@/shared/surfaces/MetricsSmartHeader";
import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

type Args = {
  controls: MetricsControlsValue;
  scopedRows: TeamRowClient[];
  header: MetricsSurfacePayload["header"];
};

type Result = {
  scopeLabel: string | null;
  headerModel: MetricsSmartHeaderModel;
};

function buildScopeLabel(controls: MetricsControlsValue): string | null {
  if (controls.reports_to_person_id) return "Supervisor Team";
  if (controls.contractor_name) return "Contractor";
  if (controls.office_label) return "Office";
  if (controls.affiliation_type) return "Affiliation";
  return null;
}

export function useManagerHeaderScope(args: Args): Result {
  const scopeLabel = useMemo(() => {
    return buildScopeLabel(args.controls);
  }, [args.controls]);

  const headerModel = useMemo<MetricsSmartHeaderModel>(() => {
    return {
      ...args.header,
      total_headcount: args.header.total_headcount ?? 0,
      scope_headcount: scopeLabel ? args.scopedRows.length : null,
    };
  }, [args.header, args.scopedRows.length, scopeLabel]);

  return {
    scopeLabel,
    headerModel,
  };
}