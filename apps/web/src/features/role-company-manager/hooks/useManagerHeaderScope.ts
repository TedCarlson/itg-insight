// path: apps/web/src/features/role-company-manager/hooks/useManagerHeaderScope.ts

"use client";

import { useMemo } from "react";

import type {
  MetricsControlsValue,
  TeamRowClient,
} from "@/shared/lib/metrics/buildScopedRows";

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

  return "Visible Scope";
}

function buildRepDisplay(header: MetricsSurfacePayload["header"]): string | null {
  const company = String(header.org_display ?? "").trim();
  const name = String(header.rep_full_name ?? "").trim();

  if (company && name) return `${company} - ${name}`;
  if (name) return name;
  if (company) return company;

  return null;
}

export function useManagerHeaderScope(args: Args): Result {
  const scopeLabel = useMemo(() => {
    return buildScopeLabel(args.controls);
  }, [args.controls]);

  const headerModel = useMemo<MetricsSmartHeaderModel>(() => {
    return {
      ...args.header,
      rep_full_name: buildRepDisplay(args.header),
      total_headcount: args.header.total_headcount ?? 0,
      scope_headcount: args.scopedRows.length,
    };
  }, [args.header, args.scopedRows.length]);

  return {
    scopeLabel,
    headerModel,
  };
}