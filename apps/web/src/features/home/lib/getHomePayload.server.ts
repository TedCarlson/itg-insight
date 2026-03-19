import { bootstrapProfileServer } from "@/lib/auth/bootstrapProfile.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type HomeRole =
  | "TECH"
  | "BP_SUPERVISOR"
  | "BP_OWNER"
  | "UNKNOWN";

export type HomeDestination = {
  label: string;
  href: string;
  description: string;
};

export type HomePayload = {
  full_name: string | null;
  role: HomeRole;
  org_label: string | null;
  destinations: HomeDestination[];
};

function resolveRole(assignments: any[]): HomeRole {
  const titles = new Set(
    assignments
      .map((a) => (a.position_title ? String(a.position_title).trim() : null))
      .filter(Boolean)
  );

  if (titles.has("BP Owner")) return "BP_OWNER";
  if (titles.has("BP Supervisor")) return "BP_SUPERVISOR";
  if (titles.has("Technician")) return "TECH";

  return "UNKNOWN";
}

async function loadOrgLabel(pc_org_id: string): Promise<string | null> {
  const admin = supabaseAdmin();

  const { data } = await admin
    .from("pc_org")
    .select("pc_org_name")
    .eq("pc_org_id", pc_org_id)
    .maybeSingle();

  return data?.pc_org_name ?? null;
}

function buildDestinations(role: HomeRole): HomeDestination[] {
  if (role === "BP_OWNER" || role === "BP_SUPERVISOR") {
    return [
      {
        label: "BP View",
        href: "/bp/view",
        description: "Team performance, KPI strip, and risk surface",
      },
    ];
  }

  if (role === "TECH") {
    return [
      {
        label: "Tech Metrics",
        href: "/tech/metrics",
        description: "Your KPI tiles, bands, and metric drill-ins",
      },
    ];
  }

  return [
    {
      label: "Workspace",
      href: "/home",
      description: "Role and access could not be resolved yet",
    },
  ];
}

export async function getHomePayload(): Promise<HomePayload> {
  const [boot, scope] = await Promise.all([
    bootstrapProfileServer(),
    requireSelectedPcOrgServer(),
  ]);

  if (!boot.ok || !boot.person_id) {
    throw new Error("No linked person");
  }

  if (!scope.ok) {
    throw new Error("No org selected");
  }

  const admin = supabaseAdmin();

  const [personRes, assignmentRes, orgLabel] = await Promise.all([
    admin
      .from("person")
      .select("full_name")
      .eq("person_id", boot.person_id)
      .maybeSingle(),

    admin
      .from("assignment_admin_v")
      .select("position_title,active")
      .eq("person_id", boot.person_id)
      .eq("pc_org_id", scope.selected_pc_org_id)
      .eq("active", true),

    loadOrgLabel(scope.selected_pc_org_id),
  ]);

  const role = resolveRole(assignmentRes.data ?? []);
  const destinations = buildDestinations(role);

  return {
    full_name: personRes.data?.full_name ?? null,
    role,
    org_label: orgLabel,
    destinations,
  };
}