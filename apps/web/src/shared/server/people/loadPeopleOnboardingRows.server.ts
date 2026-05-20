// path: apps/web/src/shared/server/people/loadPeopleOnboardingRows.server.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type PeopleOnboardingRow = {
  person_id: string;
  full_name: string | null;
  status: string;
  tech_id: string | null;
  mobile: string | null;
  email: string | null;
  nt_login: string | null;
  csg: string | null;
  prospecting_affiliation_id: string | null;
  affiliation_code: string | null;
  affiliation: string | null;
  active_assignment_count: number;
  active_orgs: string | null;
  created_at?: string | null;
  onboarding_date?: string | null;
  days_in_pipeline?: number | null;
};

export async function loadPeopleOnboardingRows(args: {
  pc_org_id: string;
  limit?: number;
}): Promise<PeopleOnboardingRow[]> {
  const adminClient = supabaseAdmin();

  const { data, error } = await adminClient.rpc("people_onboarding_list_v2", {
    p_pc_org_id: args.pc_org_id,
    p_limit: args.limit ?? 500,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as PeopleOnboardingRow[]).map((row) => {
    const dateValue = row.onboarding_date ?? row.created_at;

    if (!dateValue) {
      return {
        ...row,
        days_in_pipeline: null,
      };
    }

    const start = new Date(String(dateValue).slice(0, 10));
    const today = new Date();

    const diffMs =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).getTime() -
      new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
      ).getTime();

    return {
      ...row,
      days_in_pipeline: Math.max(0, Math.floor(diffMs / 86400000)),
    };
  });
}

export function getActivePeopleOnboardingRows(
  rows: PeopleOnboardingRow[]
): PeopleOnboardingRow[] {
  return rows.filter((row) => row.status === "onboarding");
}