// path: apps/web/src/features/role-bp-supervisor/hooks/useBpSupervisorHeaderScope.ts

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
  allRows: TeamRowClient[];
  scopedRows: TeamRowClient[];
  header: MetricsSurfacePayload["header"];
};

type Result = {
  scopeLabel: string | null;
  headerModel: MetricsSmartHeaderModel;
};

function buildScopeLabel(controls: MetricsControlsValue): string | null {
  if (controls.reports_to_person_id) return "Your Team";
  return "Affiliate";
}

function resolveAffiliateName(rows: TeamRowClient[]): string | null {
  const values = Array.from(
    new Set(
      rows
        .map((r) => String(r.contractor_name ?? "").trim())
        .filter(Boolean)
    )
  );

  return values.length === 1 ? values[0] : null;
}

function joinAffiliateAndRep(args: {
  affiliateName: string | null;
  repName: string | null | undefined;
}) {
  const affiliate = String(args.affiliateName ?? "").trim();
  const rep = String(args.repName ?? "").trim();

  if (affiliate && rep) return `${affiliate} • ${rep}`;
  if (rep) return rep;
  if (affiliate) return affiliate;
  return null;
}

export function useBpSupervisorHeaderScope(args: Args): Result {
  const scopeLabel = useMemo(() => {
    return buildScopeLabel(args.controls);
  }, [args.controls]);

  const affiliateName = useMemo(() => {
    return (
      resolveAffiliateName(args.scopedRows) ??
      resolveAffiliateName(args.allRows)
    );
  }, [args.scopedRows, args.allRows]);

  const headerModel = useMemo<MetricsSmartHeaderModel>(() => {
    return {
      ...args.header,
      rep_full_name: joinAffiliateAndRep({
        affiliateName,
        repName: args.header.rep_full_name,
      }),
      total_headcount: args.allRows.length,
      scope_headcount: args.scopedRows.length,
    };
  }, [
    args.header,
    args.allRows.length,
    args.scopedRows.length,
    affiliateName,
  ]);

  return {
    scopeLabel,
    headerModel,
  };
}