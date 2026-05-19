// path: apps/web/src/shared/server/metrics/loadMetricOwnershipRows.server.ts

import { supabaseServer } from "@/shared/data/supabase/server";

export type MetricOwnershipResolutionStatus =
  | "resolved"
  | "missing_person"
  | "missing_workspace_owner";

export type MetricOwnershipWarningReason =
  | "missing_person"
  | "missing_workspace_owner"
  | "missing_person_affiliation"
  | null;

export type MetricOwnershipRow = {
  metric_batch_id: string;
  workspace_id: string | null;
  profile_key: string | null;
  metric_date: string | null;
  fiscal_end_date: string | null;
  tech_id: string;

  person_id: string | null;
  full_name: string | null;
  person_status: string | null;
  prospecting_affiliation_id: string | null;

  contractor_id: string | null;
  contractor_name: string | null;
  contractor_code: string | null;
  pc_org_id: string | null;
  pc_org_name: string | null;

  resolution_status: MetricOwnershipResolutionStatus;
  has_resolution_warning: boolean;
  warning_reason: MetricOwnershipWarningReason;
};

const PAGE_SIZE = 1000;

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function toResolutionStatus(value: unknown): MetricOwnershipResolutionStatus {
  const s = toNullableString(value);

  if (s === "missing_person" || s === "missing_workspace_owner") {
    return s;
  }

  return "resolved";
}

function toWarningReason(value: unknown): MetricOwnershipWarningReason {
  const s = toNullableString(value);

  if (
    s === "missing_person" ||
    s === "missing_workspace_owner" ||
    s === "missing_person_affiliation"
  ) {
    return s;
  }

  return null;
}

export async function loadMetricOwnershipRows(args: {
  profile_key: string;
  metric_batch_ids: string[];
}): Promise<MetricOwnershipRow[]> {
  if (!args.metric_batch_ids.length) return [];

  const sb = await supabaseServer();
  const allRows: any[] = [];

  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await sb
      .from("metric_ownership_resolution_v")
      .select(
        `
          metric_batch_id,
          workspace_id,
          profile_key,
          metric_date,
          fiscal_end_date,
          tech_id,
          person_id,
          full_name,
          person_status,
          prospecting_affiliation_id,
          contractor_id,
          contractor_name,
          contractor_code,
          pc_org_id,
          pc_org_name,
          resolution_status,
          has_resolution_warning,
          warning_reason
        `
      )
      .eq("profile_key", args.profile_key)
      .in("metric_batch_id", args.metric_batch_ids)
      .order("metric_date", { ascending: true })
      .order("metric_batch_id", { ascending: true })
      .order("tech_id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];
    allRows.push(...page);

    if (page.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows.map((row) => ({
    metric_batch_id: String(row.metric_batch_id),
    workspace_id: toNullableString(row.workspace_id),
    profile_key: toNullableString(row.profile_key),
    metric_date: toNullableString(row.metric_date),
    fiscal_end_date: toNullableString(row.fiscal_end_date),
    tech_id: String(row.tech_id ?? "").trim(),

    person_id: toNullableString(row.person_id),
    full_name: toNullableString(row.full_name),
    person_status: toNullableString(row.person_status),
    prospecting_affiliation_id: toNullableString(row.prospecting_affiliation_id),

    contractor_id: toNullableString(row.contractor_id),
    contractor_name: toNullableString(row.contractor_name),
    contractor_code: toNullableString(row.contractor_code),
    pc_org_id: toNullableString(row.pc_org_id),
    pc_org_name: toNullableString(row.pc_org_name),

    resolution_status: toResolutionStatus(row.resolution_status),
    has_resolution_warning: toBoolean(row.has_resolution_warning),
    warning_reason: toWarningReason(row.warning_reason),
  }));
}
