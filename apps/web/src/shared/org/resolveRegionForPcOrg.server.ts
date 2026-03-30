import { supabaseAdmin } from "@/shared/data/supabase/admin";

type PcOrgAdminRow = {
  pc_org_id?: string | null;
  pc_org_name?: string | null;
  region_id?: string | null;
};

type RegionAdminRow = {
  region_id?: string | null;
  region_code?: string | null;
};

export type ResolvedRegionForPcOrg = {
  region_id: string | null;
  region_code: string | null;
};

export async function resolveRegionForPcOrg(args: {
  pc_org_id: string | null | undefined;
}): Promise<ResolvedRegionForPcOrg> {
  const admin = supabaseAdmin();

  const pcOrgId = String(args.pc_org_id ?? "").trim();
  if (!pcOrgId) {
    return {
      region_id: null,
      region_code: null,
    };
  }

  const { data: pcOrgRow, error: pcOrgError } = await admin
    .from("pc_org_admin_v")
    .select("pc_org_id,pc_org_name,region_id")
    .eq("pc_org_id", pcOrgId)
    .maybeSingle();

  if (pcOrgError) {
    throw new Error(
      `resolveRegionForPcOrg pc_org_admin_v failed: ${pcOrgError.message}`
    );
  }

  const regionId = String(
    (pcOrgRow as PcOrgAdminRow | null)?.region_id ?? ""
  ).trim();

  if (!regionId) {
    return {
      region_id: null,
      region_code: null,
    };
  }

  const { data: regionRow, error: regionError } = await admin
    .from("region_admin_v")
    .select("region_id,region_code")
    .eq("region_id", regionId)
    .maybeSingle();

  if (regionError) {
    throw new Error(
      `resolveRegionForPcOrg region_admin_v failed: ${regionError.message}`
    );
  }

  const regionCode = String(
    (regionRow as RegionAdminRow | null)?.region_code ?? ""
  ).trim();

  return {
    region_id: regionId || null,
    region_code: regionCode || null,
  };
}