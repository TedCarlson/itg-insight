// path: apps/web/src/shared/lib/metrics/buildScopedRows.ts

import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";

export type MetricsControlsValue = {
  office_label: string | null;
  affiliation_type: string | null;
  contractor_name?: string | null;
  reports_to_person_id?: string | null;
  team_scope_mode?: "ROLLUP" | "DIRECT" | "AFFILIATION_DIRECT";
};

export type TeamRowClient = {
  subject_key: string;
  person_id?: string | null;
  full_name?: string | null;
  tech_id?: string | null;
  composite_score?: number | null;
  rank?: number | null;
  jobs_display?: string | null;
  risk_count?: number | null;
  work_mix?: {
    total: number;
    installs: number;
    tcs: number;
    sros: number;
  } | null;
  office_label?: string | null;
  affiliation_type?: string | null;
  contractor_name?: string | null;
  reports_to_person_id?: string | null;
  reports_to_label?: string | null;
  co_code?: string | null;
  supervisor_chain_person_ids?: string[];
  metrics: Array<{
    metric_key: string;
    label?: string | null;
    metric_value: number | null;
    render_band_key?: string | null;
    weighted_points?: number | null;
    numerator?: number | null;
    denominator?: number | null;
  }>;
};

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeChain(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
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

export function mapTeamRows(payload: MetricsSurfacePayload): TeamRowClient[] {
  return payload.team_table.rows.map((row, index) => {
    const unsafeRow = row as any;

    return {
      subject_key:
        row.row_key ??
        row.tech_id?.trim() ??
        `${row.full_name?.trim() || "unknown"}-${index}`,
      person_id: toNullableString(unsafeRow.person_id),
      full_name: row.full_name,
      tech_id: row.tech_id,
      composite_score: row.composite_score,
      rank: row.rank,
      jobs_display: row.jobs_display ?? null,
      risk_count: row.risk_count ?? null,
      work_mix: row.work_mix ?? null,
      office_label: row.office_label ?? null,
      affiliation_type: row.affiliation_type ?? null,
      contractor_name: unsafeRow.contractor_name ?? null,
      reports_to_person_id: row.reports_to_person_id ?? null,
      reports_to_label: row.reports_to_label ?? null,
      co_code: row.co_code ?? null,
      supervisor_chain_person_ids: normalizeChain(
        unsafeRow.supervisor_chain_person_ids
      ),
      metrics: row.metrics.map((metric) => ({
        metric_key: metric.metric_key,
        label: metric.metric_key,
        metric_value: metric.value,
        render_band_key: metric.band_key,
        weighted_points: metric.weighted_points,
        numerator: metric.numerator ?? null,
        denominator: metric.denominator ?? null,
      })),
    };
  });
}

export function buildScopedRows(
  rows: TeamRowClient[],
  controls: MetricsControlsValue
): TeamRowClient[] {
  const firstClassRows = rows.filter((row) => {
    if (controls.office_label && row.office_label !== controls.office_label)
      return false;
    if (
      controls.affiliation_type &&
      row.affiliation_type !== controls.affiliation_type
    )
      return false;
    if (
      controls.contractor_name &&
      row.contractor_name !== controls.contractor_name
    )
      return false;

    return true;
  });

  const supervisorId = String(
    controls.reports_to_person_id ?? ""
  ).trim();

  if (!supervisorId) return firstClassRows;

  const directRows = firstClassRows.filter(
    (row) =>
      String(row.reports_to_person_id ?? "").trim() === supervisorId
  );

  const affiliationRows = firstClassRows.filter((row) => {
    const chain = row.supervisor_chain_person_ids ?? [];
    const isInChain = chain.includes(supervisorId);

    const isDirect =
      String(row.reports_to_person_id ?? "").trim() === supervisorId;

    return isInChain && !isDirect;
  });

  const mode = controls.team_scope_mode ?? "ROLLUP";

  if (mode === "DIRECT") return dedupeRows(directRows);
  if (mode === "AFFILIATION_DIRECT") return dedupeRows(affiliationRows);

  return dedupeRows([...directRows, ...affiliationRows]);
}