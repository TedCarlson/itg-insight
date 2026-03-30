import { supabaseAdmin } from "@/shared/data/supabase/admin";
import {
  fetchMetricRawRows,
  groupRowsByTech,
  type RangeKey,
} from "./metricResolverShared";
import { resolveFiscalSelection } from "@/shared/kpis/core/rowSelection";
import type { RawMetricRow } from "@/shared/kpis/core/types";

export async function resolveMetricFactsByTech(args: {
  admin?: ReturnType<typeof supabaseAdmin>;
  techIds: string[];
  pcOrgIds: string[];
  range: RangeKey;
}): Promise<Map<string, Record<string, unknown>[]>> {
  const admin = args.admin ?? supabaseAdmin();
  const out = new Map<string, Record<string, unknown>[]>();

  if (!args.techIds.length || !args.pcOrgIds.length) {
    return out;
  }

  const rows = await fetchMetricRawRows({
    admin,
    techIds: args.techIds,
    pcOrgIds: args.pcOrgIds,
  });

  const rowsByTech = groupRowsByTech(rows);

  for (const techId of args.techIds) {
    const techRows = (rowsByTech.get(techId) ?? []) as RawMetricRow[];
    const { selectedFinalRows } = resolveFiscalSelection(techRows, args.range);

    out.set(
      techId,
      selectedFinalRows.map((entry) => entry.row.raw)
    );
  }

  return out;
}