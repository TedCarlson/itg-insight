import { bootstrapProfileServer } from "@/lib/auth/bootstrapProfile.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type HomeRole =
  | "APP_OWNER"
  | "ADMIN"
  | "TECH"
  | "BP_SUPERVISOR"
  | "BP_LEAD"
  | "BP_OWNER"
  | "ITG_SUPERVISOR"
  | "COMPANY_MANAGER"
  | "UNSCOPED"
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
  selected_pc_org_id: string | null;
  destinations: HomeDestination[];
  has_linked_person: boolean;
  has_selected_org: boolean;
};

type BootShape = {
  ok?: boolean;
  person_id?: string | null;
  full_name?: string | null;
  is_owner?: boolean;
  is_admin?: boolean;
  is_app_owner?: boolean;
};

function resolveRole(
  assignments: Array<{ position_title?: string | null }>
): HomeRole {
  const titles = new Set(
    assignments
      .map((a) => (a.position_title ? String(a.position_title).trim() : null))
      .filter(Boolean)
  );

  if (titles.has("BP Owner")) return "BP_OWNER";
  if (titles.has("BP Lead")) return "BP_LEAD";
  if (titles.has("BP Supervisor")) return "BP_SUPERVISOR";
  if (titles.has("ITG Supervisor")) return "ITG_SUPERVISOR";
  if (
    titles.has("Manager") ||
    titles.has("Project Manager") ||
    titles.has("Regional Manager")
  ) {
    return "COMPANY_MANAGER";
  }
  if (titles.has("Technician")) return "TECH";

  return "UNKNOWN";
}

function resolvePrivilegedRole(boot: BootShape): HomeRole | null {
  if (boot?.is_app_owner) return "APP_OWNER";
  if (boot?.is_owner) return "APP_OWNER";
  if (boot?.is_admin) return "ADMIN";
  return null;
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

function buildPrivilegedDestinations(
  hasSelectedOrg: boolean
): HomeDestination[] {
  const items: HomeDestination[] = [
    {
      label: "Home",
      href: "/home",
      description: "Workspace landing and access-aware navigation",
    },
    {
      label: "Admin",
      href: "/admin",
      description: "Administration and system-level controls",
    },
    {
      label: "Roster",
      href: "/roster",
      description: "Org roster, assignments, and reporting structure",
    },
    {
      label: "Metrics",
      href: "/metrics",
      description: "Metrics reporting, uploads, and configuration",
    },
    {
      label: "Field Log",
      href: "/field-log",
      description: "Submit, review, and track field activity",
    },
  ];

  if (hasSelectedOrg) {
    items.splice(3, 0, {
      label: "BP View",
      href: "/bp/view",
      description: "Team performance, KPI strip, and risk surface",
    });

    items.splice(4, 0, {
      label: "Company Supervisor",
      href: "/company-supervisor",
      description: "Hybrid workforce view across ITG and BP reporting scope",
    });

    items.splice(5, 0, {
      label: "Company Manager",
      href: "/company-manager",
      description: "Manager rollups across office, leadership, and workforce",
    });

    items.splice(6, 0, {
      label: "Dispatch Console",
      href: "/dispatch-console",
      description: "Live job routing, assignments, and activity log",
    });
  }

  return items;
}

function buildDestinations(
  role: HomeRole,
  hasSelectedOrg: boolean
): HomeDestination[] {
  if (role === "APP_OWNER" || role === "ADMIN") {
    return buildPrivilegedDestinations(hasSelectedOrg);
  }

  if (role === "ITG_SUPERVISOR") {
    return [
      {
        label: "Company Supervisor",
        href: "/company-supervisor",
        description: "Hybrid workforce performance, KPI strip, and risk surface",
      },
      {
        label: "Metrics Uploads",
        href: "/metrics/uploads",
        description: "Legacy bridge for metrics upload operations",
      },
      {
        label: "Route Lock",
        href: "/route-lock",
        description: "Schedule, quota, and route planning controls",
      },
      {
        label: "Dispatch Console",
        href: "/dispatch-console",
        description: "Live job routing, assignments, and activity log",
      },
      {
        label: "Field Log",
        href: "/field-log",
        description: "Submit, review, and track field activity",
      },
    ];
  }

  if (role === "COMPANY_MANAGER") {
    return [
      {
        label: "Company Manager",
        href: "/company-manager",
        description: "Office, leadership, and workforce performance suite",
      },
      {
        label: "Metrics Uploads",
        href: "/metrics/uploads",
        description: "Legacy bridge for metrics upload operations",
      },
      {
        label: "Route Lock",
        href: "/route-lock",
        description: "Schedule, quota, and route planning controls",
      },
      {
        label: "Dispatch Console",
        href: "/dispatch-console",
        description: "Live job routing, assignments, and activity log",
      },
      {
        label: "Field Log",
        href: "/field-log",
        description: "Submit, review, and track field activity",
      },
    ];
  }

  if (role === "BP_OWNER" || role === "BP_LEAD" || role === "BP_SUPERVISOR") {
    return [
      {
        label: "BP View",
        href: "/bp/view",
        description: "Team performance, KPI strip, and risk surface",
      },
      {
        label: "Dispatch Console",
        href: "/dispatch-console",
        description: "Live job routing, assignments, and activity log",
      },
      {
        label: "Field Log",
        href: "/field-log",
        description: "Submit, review, and track field activity",
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
      {
        label: "Schedule",
        href: "/schedule",
        description: "View assigned routes and planned workload",
      },
      {
        label: "Dispatch Console",
        href: "/dispatch-console",
        description: "View job flow and updates",
      },
      {
        label: "Field Log",
        href: "/field-log",
        description: "Submit and track your field logs",
      },
    ];
  }

  if (!hasSelectedOrg) {
    return [
      {
        label: "Access",
        href: "/access",
        description: "Select an org or complete access setup",
      },
      {
        label: "Home",
        href: "/home",
        description: "Workspace landing and access-aware navigation",
      },
    ];
  }

  return [
    {
      label: "Workspace",
      href: "/home",
      description: "Role and access could not be resolved yet",
    },
    {
      label: "Dispatch Console",
      href: "/dispatch-console",
      description: "Open an available org-scoped workspace",
    },
    {
      label: "Field Log",
      href: "/field-log",
      description: "Open an available org-scoped workspace",
    },
  ];
}

export async function getHomePayload(): Promise<HomePayload> {
  const [bootRaw, scope] = await Promise.all([
    bootstrapProfileServer(),
    requireSelectedPcOrgServer(),
  ]);

  const boot = (bootRaw ?? {}) as BootShape;
  const hasLinkedPerson = Boolean(boot.ok && boot.person_id);

  const selectedPcOrgId = scope.ok ? scope.selected_pc_org_id : null;
  const hasSelectedOrg = Boolean(selectedPcOrgId);

  const privilegedRole = resolvePrivilegedRole(boot);

  if (!hasLinkedPerson) {
    const role = privilegedRole ?? (hasSelectedOrg ? "UNKNOWN" : "UNSCOPED");

    const orgLabel = selectedPcOrgId
      ? await loadOrgLabel(selectedPcOrgId)
      : null;

    return {
      full_name: boot.full_name ?? null,
      role,
      org_label: orgLabel,
      selected_pc_org_id: selectedPcOrgId,
      destinations: buildDestinations(role, hasSelectedOrg),
      has_linked_person: false,
      has_selected_org: hasSelectedOrg,
    };
  }

  const admin = supabaseAdmin();

  const personPromise = admin
    .from("person")
    .select("full_name")
    .eq("person_id", boot.person_id as string)
    .maybeSingle();

  const assignmentsPromise = selectedPcOrgId
    ? admin
        .from("assignment_admin_v")
        .select("position_title,active")
        .eq("person_id", boot.person_id as string)
        .eq("pc_org_id", selectedPcOrgId)
        .eq("active", true)
    : Promise.resolve({
        data: [] as Array<{ position_title?: string | null }>,
      });

  const orgLabelPromise = selectedPcOrgId
    ? loadOrgLabel(selectedPcOrgId)
    : Promise.resolve(null);

  const [personRes, assignmentRes, orgLabel] = await Promise.all([
    personPromise,
    assignmentsPromise,
    orgLabelPromise,
  ]);

  const resolvedRole = privilegedRole ?? resolveRole(assignmentRes.data ?? []);
  const role =
    resolvedRole === "UNKNOWN" && !hasSelectedOrg ? "UNSCOPED" : resolvedRole;

  return {
    full_name: personRes.data?.full_name ?? boot.full_name ?? null,
    role,
    org_label: orgLabel,
    selected_pc_org_id: selectedPcOrgId,
    destinations: buildDestinations(role, hasSelectedOrg),
    has_linked_person: true,
    has_selected_org: hasSelectedOrg,
  };
}