// path: apps/web/src/features/admin/access-health/lib/loadPcOrgLabels.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { clean, unique } from "./accessHealthUtils";

export async function loadPcOrgLabels(pcOrgIds: string[]) {
  const admin = supabaseAdmin();
  const ids = unique(pcOrgIds.map(clean).filter(Boolean) as string[]);

  if (!ids.length) return new Map<string, any>();

  const { data } = await admin
    .from("pc_org")
    .select("pc_org_id, pc_org_name, region_id")
    .in("pc_org_id", ids);

  return new Map((data ?? []).map((row: any) => [String(row.pc_org_id), row]));
}