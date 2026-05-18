import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

type EffectiveAssignmentRow = {
  position_title: string | null;
  role_type: string | null;
  tech_id: string | null;
  active_flag: boolean | null;
};

export type EffectiveOrgAccess = {
  ok: boolean;
  auth_user_id: string | null;
  selected_pc_org_id: string | null;
  person_id: string | null;
  contractor_id: string | null;
  is_owner: boolean;
  is_admin: boolean;
  assignment_titles: string[];
  assignments: EffectiveAssignmentRow[];
  effective_visibility:
    | "APP_ADMIN"
    | "FULL_ORG"
    | "AFFILIATE_SCOPED"
    | "SELF"
    | "NO_OPERATIONAL_SCOPE";
};

function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next || null;
}

function titleSet(rows: EffectiveAssignmentRow[]) {
  return new Set(
    rows
      .filter((row) => row.active_flag === true)
      .map((row) => clean(row.position_title))
      .filter(Boolean) as string[],
  );
}

function hasAny(titles: Set<string>, candidates: string[]) {
  return candidates.some((title) => titles.has(title));
}

export async function resolveEffectiveOrgAccess(): Promise<EffectiveOrgAccess> {
  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return {
      ok: false,
      auth_user_id: null,
      selected_pc_org_id: null,
      person_id: null,
      contractor_id: null,
      is_owner: false,
      is_admin: false,
      assignment_titles: [],
      assignments: [],
      effective_visibility: "NO_OPERATIONAL_SCOPE",
    };
  }

  const [{ data: isOwnerRaw }, { data: profile }] = await Promise.all([
    sb.rpc("is_owner"),
    admin
      .from("user_profile")
      .select("auth_user_id,person_id,core_person_id,selected_pc_org_id,is_admin,status")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
  ]);

  const isOwner = isOwnerRaw === true;
  const isAdmin = (profile as any)?.is_admin === true;
  const selectedPcOrgId = clean((profile as any)?.selected_pc_org_id);
  const personId = clean((profile as any)?.core_person_id) ?? clean((profile as any)?.person_id);

  let contractorId: string | null = null;
  if (personId) {
    const { data: person } = await admin
      .from("v_person_core")
      .select("person_id,co_ref_id")
      .eq("person_id", personId)
      .maybeSingle();

    contractorId = clean((person as any)?.co_ref_id);
  }

  let assignments: EffectiveAssignmentRow[] = [];
  if (personId && selectedPcOrgId) {
    const { data } = await admin
      .from("company_profile_fact")
      .select("position_title,role_type,tech_id,active_flag")
      .eq("person_id", personId)
      .eq("pc_org_id", selectedPcOrgId)
      .is("effective_end_date", null);

    assignments = ((data ?? []) as EffectiveAssignmentRow[]).filter(
      (row) => row.active_flag === true,
    );
  }

  const titles = titleSet(assignments);
  const assignmentTitles = Array.from(titles);

  let effectiveVisibility: EffectiveOrgAccess["effective_visibility"] =
    "NO_OPERATIONAL_SCOPE";

  if (isOwner || isAdmin) {
    effectiveVisibility = "APP_ADMIN";
  } else if (
    hasAny(titles, [
      "Director",
      "Regional Director",
      "Senior Director",
      "Manager",
      "Project Manager",
      "Regional Manager",
      "ITG Supervisor",
    ])
  ) {
    effectiveVisibility = "FULL_ORG";
  } else if (hasAny(titles, ["BP Owner", "BP Supervisor", "BP Lead"])) {
    effectiveVisibility = contractorId ? "AFFILIATE_SCOPED" : "NO_OPERATIONAL_SCOPE";
  } else if (hasAny(titles, ["Technician"])) {
    effectiveVisibility = "SELF";
  }

  return {
    ok: true,
    auth_user_id: user.id,
    selected_pc_org_id: selectedPcOrgId,
    person_id: personId,
    contractor_id: contractorId,
    is_owner: isOwner,
    is_admin: isAdmin,
    assignment_titles: assignmentTitles,
    assignments,
    effective_visibility: effectiveVisibility,
  };
}

export function canViewFullOrgRows(scope: EffectiveOrgAccess) {
  return scope.effective_visibility === "APP_ADMIN" || scope.effective_visibility === "FULL_ORG";
}

export function canViewAffiliateRows(scope: EffectiveOrgAccess) {
  return scope.effective_visibility === "AFFILIATE_SCOPED" && !!scope.contractor_id;
}
