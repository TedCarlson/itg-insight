import { bootstrapProfileServer } from "@/lib/auth/bootstrapProfile.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { AppRole } from "@/shared/navigation/types";
import type { HomeSurfaceContext } from "../contracts/home.types";

type BootShape = {
  ok?: boolean;
  person_id?: string | null;
  full_name?: string | null;
  is_owner?: boolean;
  is_admin?: boolean;
  is_app_owner?: boolean;
};

function resolvePrivilegedRole(boot: BootShape): AppRole | null {
  if (boot?.is_app_owner) return "APP_OWNER";
  if (boot?.is_owner) return "APP_OWNER";
  if (boot?.is_admin) return "ADMIN";
  return null;
}

function resolveRole(
  assignments: Array<{
    position_title?: string | null;
    role_type?: string | null;
  }>,
): AppRole {
  const titles = new Set(
    assignments
      .map((a) => (a.position_title ? String(a.position_title).trim() : null))
      .filter(Boolean)
  );

  if (titles.has("BP Owner")) return "BP_OWNER";
  if (titles.has("BP Lead")) return "BP_LEAD";
  if (titles.has("BP Supervisor")) return "BP_SUPERVISOR";
  if (titles.has("Director") || titles.has("Regional Director") || titles.has("Senior Director")) return "DIRECTOR";
  if (titles.has("Manager") || titles.has("Project Manager") || titles.has("Regional Manager")) return "COMPANY_MANAGER";
  if (
    titles.has("ITG Supervisor") ||
    titles.has("Supervisor") ||
    titles.has("Company Supervisor") ||
    titles.has("Fulfillment Supervisor") ||
    titles.has("Locate Supervisor")
  ) {
    return "ITG_SUPERVISOR";
  }

  if (titles.has("Support")) return "SUPPORT";
  if (
    titles.has("Support") ||
    assignments.some(
      (assignment) =>
        String((assignment as { role_type?: string | null }).role_type ?? "")
          .trim()
          .toUpperCase() === "SUPPORT",
    )
  ) {
    return "SUPPORT";
  }

  if (titles.has("Technician")) return "TECH";

  return "UNKNOWN";
}

async function loadOrgLabel(pcOrgId: string) {
  const admin = supabaseAdmin();

  const { data } = await admin
    .from("pc_org")
    .select("pc_org_name")
    .eq("pc_org_id", pcOrgId)
    .maybeSingle();

  return data?.pc_org_name ?? null;
}

export async function loadHomeUserContext(): Promise<HomeSurfaceContext> {
  const [bootRaw, scope] = await Promise.all([
    bootstrapProfileServer(),
    requireSelectedPcOrgServer(),
  ]);

  const boot = (bootRaw ?? {}) as BootShape;
  const privilegedRole = resolvePrivilegedRole(boot);
  const selectedPcOrgId = scope.ok ? scope.selected_pc_org_id : null;
  const hasSelectedOrg = Boolean(selectedPcOrgId);
  const hasLinkedPerson = Boolean(boot.ok && (boot.person_id || privilegedRole));

  if (!boot.person_id) {
    const role = privilegedRole ?? (hasSelectedOrg ? "UNKNOWN" : "UNSCOPED");

    return {
      full_name: boot.full_name ?? null,
      role,
      org_label: selectedPcOrgId ? await loadOrgLabel(selectedPcOrgId) : null,
      selected_pc_org_id: selectedPcOrgId,
      has_linked_person: hasLinkedPerson,
      has_selected_org: hasSelectedOrg,
    };
  }

  const admin = supabaseAdmin();

  const personPromise = admin
    .from("person")
    .select("full_name")
    .eq("person_id", boot.person_id)
    .maybeSingle();

  const assignmentsPromise = selectedPcOrgId
    ? admin
        .from("company_profile_fact")
        .select("position_title,role_type,active_flag,effective_end_date")
        .eq("person_id", boot.person_id)
        .eq("pc_org_id", selectedPcOrgId)
        .eq("active_flag", true)
        .is("effective_end_date", null)
    : Promise.resolve({
        data: [] as Array<{
          position_title?: string | null;
          role_type?: string | null;
        }>,
      });

  const orgLabelPromise = selectedPcOrgId ? loadOrgLabel(selectedPcOrgId) : Promise.resolve(null);

  const [personRes, assignmentRes, orgLabel] = await Promise.all([
    personPromise,
    assignmentsPromise,
    orgLabelPromise,
  ]);

  const resolvedRole = privilegedRole ?? resolveRole(assignmentRes.data ?? []);
  const role = resolvedRole === "UNKNOWN" && !hasSelectedOrg ? "UNSCOPED" : resolvedRole;

  return {
    full_name: personRes.data?.full_name ?? boot.full_name ?? null,
    role,
    org_label: orgLabel,
    selected_pc_org_id: selectedPcOrgId,
    has_linked_person: true,
    has_selected_org: hasSelectedOrg,
  };
}
