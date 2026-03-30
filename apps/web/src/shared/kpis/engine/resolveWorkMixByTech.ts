import { supabaseAdmin } from "@/shared/data/supabase/admin";
import {
  fetchMetricRawRows,
  getFinalRowsPerMonth,
  groupRowsByTech,
  pickNum,
  resolveFiscalEndDatesForRange,
  type RangeKey,
} from "./metricResolverShared";

type WorkMixRow = {
  installs: number;
  tcs: number;
  sros: number;
  total: number;
};

export async function resolveWorkMixByTech(args: {
  admin?: ReturnType<typeof supabaseAdmin>;
  techIds: string[];
  pcOrgIds: string[];
  range: RangeKey;
  fiscalEndDates?: string[];
}): Promise<Map<string, WorkMixRow>> {
  const admin = args.admin ?? supabaseAdmin();
  const { techIds, pcOrgIds, range } = args;

  const result = new Map<string, WorkMixRow>();

  if (!techIds.length || !pcOrgIds.length) {
    return result;
  }

  const fiscalEndDates =
    args.fiscalEndDates && args.fiscalEndDates.length
      ? args.fiscalEndDates
      : await resolveFiscalEndDatesForRange({
          admin,
          range,
        });

  const rows = await fetchMetricRawRows({
    admin,
    techIds,
    pcOrgIds,
    fiscalEndDates,
  });

  const rowsByTech = groupRowsByTech(rows);

  for (const techId of techIds) {
    const techRows = rowsByTech.get(techId) ?? [];
    const finalRowsByMonth = getFinalRowsPerMonth(techRows);

    let installs = 0;
    let tcs = 0;
    let sros = 0;

    for (const month of finalRowsByMonth) {
      const raw = month.row.raw;

      installs += pickNum(raw, ["Installs", "installs"]) ?? 0;
      tcs += pickNum(raw, ["TCs", "tcs", "TC"]) ?? 0;
      sros += pickNum(raw, ["SROs", "sros", "SRO"]) ?? 0;
    }

    result.set(techId, {
      installs,
      tcs,
      sros,
      total: installs + tcs + sros,
    });
  }

  return result;
}