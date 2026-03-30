import type {
  RankContextByPerson,
  RankResolverConfig,
} from "@/shared/kpis/contracts/rankTypes";
import { resolveRankContextByTech } from "@/shared/kpis/engine/resolveRankContextByTech";
import { resolveEligibleRankPopulation } from "@/shared/kpis/engine/resolveEligibleRankPopulation.server";

type ReportClassType = "P4P" | "SMART" | "TECH";

type Args = {
  pc_org_ids: string[];
  class_type: ReportClassType;
  batch_id?: string | null;
  config?: RankResolverConfig;
};

export async function getRankContextByTech(
  args: Args
): Promise<RankContextByPerson> {
  const rows = await resolveEligibleRankPopulation({
    pc_org_ids: args.pc_org_ids,
    class_type: args.class_type,
    batch_id: args.batch_id ?? null,
  });

  return resolveRankContextByTech(rows, args.config);
}