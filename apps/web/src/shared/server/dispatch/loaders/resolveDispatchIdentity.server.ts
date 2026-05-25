import type { DispatchIdentity, SupabaseAdminClient } from "../types/dispatchLog.types";
import { dispatchBadRequest } from "../utils/dispatchErrors";

export async function resolveDispatchIdentity(args: {
  admin: SupabaseAdminClient;
  pc_org_id: string;
  shift_date: string;
  assignment_id: string;
}): Promise<DispatchIdentity> {
  const { admin, pc_org_id, shift_date, assignment_id } = args;

  const day = await admin
    .from("dispatch_day_tech")
    .select("person_id,tech_id,affiliation_id")
    .eq("pc_org_id", pc_org_id)
    .eq("shift_date", shift_date)
    .eq("assignment_id", assignment_id)
    .maybeSingle();

  let person_id: string | null = day.data?.person_id ?? null;
  let tech_id: string | null = day.data?.tech_id ?? null;
  let affiliation_id: string | null = day.data?.affiliation_id ?? null;

  if (!person_id || !tech_id || !affiliation_id) {
    const workforce = await admin
      .from("workforce_current_v")
      .select("person_id,tech_id,affiliation_id")
      .eq("pc_org_id", pc_org_id)
      .eq("assignment_id", assignment_id)
      .eq("is_active", true)
      .eq("assignment_status", "active")
      .maybeSingle();

    if (workforce.error) {
      dispatchBadRequest("workforce_identity_lookup_failed", workforce.error);
    }

    person_id = person_id ?? workforce.data?.person_id ?? null;
    tech_id = tech_id ?? (workforce.data?.tech_id ? String(workforce.data.tech_id) : null);
    affiliation_id = affiliation_id ?? workforce.data?.affiliation_id ?? null;
  }

  if (!person_id || !tech_id) {
    const roster = await admin
      .from("route_lock_roster_tech_v")
      .select("person_id,tech_id")
      .eq("pc_org_id", pc_org_id)
      .eq("assignment_id", assignment_id)
      .maybeSingle();

    if (roster.error) dispatchBadRequest("roster_lookup_failed", roster.error);

    person_id = person_id ?? roster.data?.person_id ?? null;
    tech_id = tech_id ?? (roster.data?.tech_id ? String(roster.data.tech_id) : null);
  }

  if (!person_id || !tech_id) {
    dispatchBadRequest("identity_unresolved");
  }

  return { person_id, tech_id, affiliation_id };
}