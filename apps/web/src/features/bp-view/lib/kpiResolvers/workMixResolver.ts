import { supabaseAdmin } from "@/shared/data/supabase/admin";
import {
  fetchMetricRawRows,
  getFinalRowsPerMonth,
  groupRowsByTech,
  monthsToTake,
  pickNum,
  type RangeKey,
} from "./shared";

type WorkMixRow = {
  installs: number;
  tcs: number;
  sros: number;
  total: number;
};

export async function resolveBpWorkMixByTech(args: {
  admin?: ReturnType<typeof supabaseAdmin>;
  techIds: string[];
  pcOrgIds: string[];
  range: RangeKey;
}): Promise<Map<string, WorkMixRow>> {
  const admin = args.admin ?? supabaseAdmin();
  const { techIds, pcOrgIds, range } = args;

  const result = new Map<string, WorkMixRow>();

  if (!techIds.length || !pcOrgIds.length) {
    return result;
  }

  const rows = await fetchMetricRawRows({
    admin,
    techIds,
    pcOrgIds,
  });

  const rowsByTech = groupRowsByTech(rows);
  const monthLimit = monthsToTake(range);

  for (const techId of techIds) {
    const techRows = rowsByTech.get(techId) ?? [];
    const selectedMonths = getFinalRowsPerMonth(techRows).slice(0, monthLimit);

    let installs = 0;
    let tcs = 0;
    let sros = 0;

    for (const month of selectedMonths) {
      const raw = month.row.raw;

      installs += pickNum(raw, [
        "Installs",
        "installs",
      ]) ?? 0;

      tcs += pickNum(raw, [
        "TCs",
        "tcs",
        "TC",
      ]) ?? 0;

      sros += pickNum(raw, [
        "SROs",
        "sros",
        "SRO",
      ]) ?? 0;
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