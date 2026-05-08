// path: apps/web/src/app/api/admin/user-access-health/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

type HealthWarning =
    | "missing_user_profile"
    | "profile_not_active"
    | "missing_person_link"
    | "missing_selected_org"
    | "selected_org_not_in_person_memberships"
    | "no_legacy_assignment_in_selected_org"
    | "no_core_assignment_in_selected_org"
    | "no_permission_grants_in_selected_org"
    | "role_not_resolved";

type AssignmentHealthRow = {
    source: "legacy" | "core";
    assignment_id: string | null;
    person_id: string | null;
    pc_org_id: string | null;
    workspace_id?: string | null;
    tech_id: string | null;
    position_title: string | null;
    role_type?: string | null;
    assignment_status?: string | null;
    active: boolean | null;
    start_date: string | null;
    end_date: string | null;
};

type GrantHealthRow = {
    pc_org_id: string | null;
    permission_key: string | null;
    expires_at: string | null;
    revoked_at: string | null;
};

type UserAccessHealthRow = {
    auth_user_id: string;
    email: string | null;
    last_sign_in_at: string | null;

    profile: {
        exists: boolean;
        status: string | null;
        person_id: string | null;
        selected_pc_org_id: string | null;
        is_admin: boolean;
    };

    person: {
        exists: boolean;
        person_id: string | null;
        full_name: string | null;
        emails: string | null;
        active: boolean | null;
    };

    selected_org: {
        pc_org_id: string | null;
        pc_org_name: string | null;
        region_id: string | null;
    };

    memberships: Array<{
        person_id: string | null;
        pc_org_id: string | null;
        pc_org_name: string | null;
    }>;

    assignments: {
        legacy_selected_org: AssignmentHealthRow[];
        core_selected_org: AssignmentHealthRow[];
    };

    grants_selected_org: GrantHealthRow[];

    resolved: {
        role_key: string;
        home_href: string | null;
    };

    health: {
        ok: boolean;
        warnings: HealthWarning[];
    };
};

function clean(value: unknown): string | null {
    const next = String(value ?? "").trim();
    return next || null;
}

async function requireAccessHealthAdmin() {
    const userClient = await supabaseServer();
    const admin = supabaseAdmin();

    const {
        data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
        return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const { data: profile } = await admin
        .from("user_profile")
        .select("is_admin")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    const { data: appOwner } = await admin
        .from("app_owners")
        .select("auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (profile?.is_admin === true || appOwner?.auth_user_id) {
        return { ok: true as const };
    }

    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}

function bool(value: unknown): boolean {
    return value === true;
}

function resolveRoleFromAssignments(assignments: AssignmentHealthRow[]) {
    const titles = new Set(
        assignments
            .map((row) => clean(row.position_title))
            .filter(Boolean)
            .map((value) => String(value))
    );

    if (
        titles.has("Director") ||
        titles.has("Regional Director") ||
        titles.has("Senior Director")
    ) {
        return {
            role_key: "DIRECTOR",
            home_href: "/director/executive",
        };
    }

    if (
        titles.has("Manager") ||
        titles.has("Project Manager") ||
        titles.has("Regional Manager")
    ) {
        return {
            role_key: "COMPANY_MANAGER",
            home_href: "/home",
        };
    }

    if (titles.has("ITG Supervisor")) {
        return {
            role_key: "ITG_SUPERVISOR",
            home_href: "/home",
        };
    }

    if (titles.has("BP Supervisor")) {
        return {
            role_key: "BP_SUPERVISOR",
            home_href: "/home",
        };
    }

    if (titles.has("BP Owner")) {
        return {
            role_key: "BP_OWNER",
            home_href: "/home",
        };
    }

    if (titles.has("BP Lead")) {
        return {
            role_key: "BP_LEAD",
            home_href: "/home",
        };
    }

    if (titles.has("Technician")) {
        return {
            role_key: "TECH",
            home_href: "/home",
        };
    }

    return {
        role_key: "UNKNOWN",
        home_href: null,
    };
}

function unique<T>(values: T[]) {
    return Array.from(new Set(values));
}

async function loadPcOrgLabels(pcOrgIds: string[]) {
    const admin = supabaseAdmin();
    const ids = unique(pcOrgIds.map(clean).filter(Boolean) as string[]);

    if (!ids.length) return new Map<string, any>();

    const { data } = await admin
        .from("pc_org")
        .select("pc_org_id, pc_org_name, region_id")
        .in("pc_org_id", ids);

    return new Map((data ?? []).map((row: any) => [String(row.pc_org_id), row]));
}

async function buildHealthRow(args: {
    auth_user_id: string;
    email: string | null;
    last_sign_in_at: string | null;
}): Promise<UserAccessHealthRow> {
    const admin = supabaseAdmin();
    const warnings: HealthWarning[] = [];

    const { data: profile } = await admin
        .from("user_profile")
        .select("auth_user_id, person_id, status, is_admin, selected_pc_org_id")
        .eq("auth_user_id", args.auth_user_id)
        .maybeSingle();

    if (!profile) {
        warnings.push("missing_user_profile");
    }

    if (profile && profile.status !== "active") {
        warnings.push("profile_not_active");
    }

    const personId = clean((profile as any)?.person_id);
    const selectedPcOrgId = clean((profile as any)?.selected_pc_org_id);

    if (!personId) warnings.push("missing_person_link");
    if (!selectedPcOrgId) warnings.push("missing_selected_org");

    const { data: person } = personId
        ? await admin
            .from("person")
            .select("person_id, full_name, emails, active")
            .eq("person_id", personId)
            .maybeSingle()
        : { data: null as any };

    const { data: membershipsRaw } = personId
        ? await admin
            .from("person_pc_org")
            .select("person_id, pc_org_id")
            .eq("person_id", personId)
        : { data: [] as any[] };

    const membershipPcOrgIds = (membershipsRaw ?? [])
        .map((row: any) => clean(row.pc_org_id))
        .filter(Boolean) as string[];

    if (
        selectedPcOrgId &&
        membershipPcOrgIds.length > 0 &&
        !membershipPcOrgIds.includes(selectedPcOrgId)
    ) {
        warnings.push("selected_org_not_in_person_memberships");
    }

    const pcOrgLabelMap = await loadPcOrgLabels(
        [selectedPcOrgId, ...membershipPcOrgIds].filter(Boolean) as string[]
    );

    const selectedOrg = selectedPcOrgId
        ? pcOrgLabelMap.get(selectedPcOrgId) ?? null
        : null;

    const memberships = (membershipsRaw ?? []).map((row: any) => {
        const pcOrgId = clean(row.pc_org_id);
        const label = pcOrgId ? pcOrgLabelMap.get(pcOrgId) : null;

        return {
            person_id: clean(row.person_id),
            pc_org_id: pcOrgId,
            pc_org_name: label?.pc_org_name ?? null,
        };
    });

    const { data: legacyAssignmentsRaw } =
        personId && selectedPcOrgId
            ? await admin
                .from("assignment_admin_v")
                .select(
                    "assignment_id, person_id, pc_org_id, tech_id, position_title, active, start_date, end_date"
                )
                .eq("person_id", personId)
                .eq("pc_org_id", selectedPcOrgId)
            : { data: [] as any[] };

    const legacyAssignments: AssignmentHealthRow[] = (
        legacyAssignmentsRaw ?? []
    ).map((row: any) => ({
        source: "legacy",
        assignment_id: clean(row.assignment_id),
        person_id: clean(row.person_id),
        pc_org_id: clean(row.pc_org_id),
        tech_id: clean(row.tech_id),
        position_title: clean(row.position_title),
        active: row.active === null || row.active === undefined ? null : bool(row.active),
        start_date: clean(row.start_date),
        end_date: clean(row.end_date),
    }));

    if (personId && selectedPcOrgId && legacyAssignments.length === 0) {
        warnings.push("no_legacy_assignment_in_selected_org");
    }

    const { data: workspace } = selectedPcOrgId
        ? await admin
            .schema("core")
            .from("workspaces")
            .select("workspace_id, legacy_pc_org_id")
            .eq("legacy_pc_org_id", selectedPcOrgId)
            .maybeSingle()
        : { data: null as any };

    const workspaceId = clean((workspace as any)?.workspace_id);

    const { data: coreAssignmentsRaw } =
        personId && workspaceId
            ? await admin
                .schema("core")
                .from("assignments")
                .select(
                    "assignment_id, person_id, workspace_id, tech_id, position_title, assignment_status, start_date, end_date"
                )
                .eq("person_id", personId)
                .eq("workspace_id", workspaceId)
            : { data: [] as any[] };

    const { data: profileFactsRaw } =
        personId && selectedPcOrgId
            ? await admin
                .from("company_profile_fact")
                .select("person_id, pc_org_id, tech_id, role_type, active_flag, effective_end_date")
                .eq("person_id", personId)
                .eq("pc_org_id", selectedPcOrgId)
                .is("effective_end_date", null)
            : { data: [] as any[] };

    const roleTypeByTechId = new Map<string, string | null>();
    const roleTypeFallback = clean((profileFactsRaw ?? [])[0]?.role_type);

    for (const row of profileFactsRaw ?? []) {
        const techId = clean((row as any).tech_id);
        if (techId) roleTypeByTechId.set(techId, clean((row as any).role_type));
    }

    const coreAssignments: AssignmentHealthRow[] = (coreAssignmentsRaw ?? []).map(
        (row: any) => {
            const techId = clean(row.tech_id);

            return {
                source: "core",
                assignment_id: clean(row.assignment_id),
                person_id: clean(row.person_id),
                pc_org_id: selectedPcOrgId,
                workspace_id: clean(row.workspace_id),
                tech_id: techId,
                position_title: clean(row.position_title),
                role_type: techId
                    ? roleTypeByTechId.get(techId) ?? roleTypeFallback
                    : roleTypeFallback,
                assignment_status: clean(row.assignment_status),
                active: clean(row.assignment_status) === "active",
                start_date: clean(row.start_date),
                end_date: clean(row.end_date),
            };
        }
    );

    if (personId && selectedPcOrgId && coreAssignments.length === 0) {
        warnings.push("no_core_assignment_in_selected_org");
    }

    const { data: grantsRaw } =
        selectedPcOrgId
            ? await admin
                .from("pc_org_permission_grant")
                .select("pc_org_id, permission_key, expires_at, revoked_at")
                .eq("auth_user_id", args.auth_user_id)
                .eq("pc_org_id", selectedPcOrgId)
            : { data: [] as any[] };

    const grantsSelectedOrg: GrantHealthRow[] = (grantsRaw ?? []).map(
        (row: any) => ({
            pc_org_id: clean(row.pc_org_id),
            permission_key: clean(row.permission_key),
            expires_at: clean(row.expires_at),
            revoked_at: clean(row.revoked_at),
        })
    );

    const activeGrants = grantsSelectedOrg.filter((row) => !row.revoked_at);

    if (selectedPcOrgId && activeGrants.length === 0) {
        warnings.push("no_permission_grants_in_selected_org");
    }

    const activeLegacyAssignments = legacyAssignments.filter(
        (row) => row.active === true
    );

    const activeCoreAssignments = coreAssignments.filter(
        (row) => row.active === true
    );

    const resolved = resolveRoleFromAssignments([
        ...activeCoreAssignments,
        ...activeLegacyAssignments,
    ]);

    if (resolved.role_key === "UNKNOWN") {
        warnings.push("role_not_resolved");
    }

    return {
        auth_user_id: args.auth_user_id,
        email: args.email,
        last_sign_in_at: args.last_sign_in_at,

        profile: {
            exists: Boolean(profile),
            status: clean((profile as any)?.status),
            person_id: personId,
            selected_pc_org_id: selectedPcOrgId,
            is_admin: bool((profile as any)?.is_admin),
        },

        person: {
            exists: Boolean(person),
            person_id: clean((person as any)?.person_id),
            full_name: clean((person as any)?.full_name),
            emails: clean((person as any)?.emails),
            active:
                (person as any)?.active === null || (person as any)?.active === undefined
                    ? null
                    : bool((person as any)?.active),
        },

        selected_org: {
            pc_org_id: selectedPcOrgId,
            pc_org_name: selectedOrg?.pc_org_name ?? null,
            region_id: selectedOrg?.region_id ?? null,
        },

        memberships,

        assignments: {
            legacy_selected_org: legacyAssignments,
            core_selected_org: coreAssignments,
        },

        grants_selected_org: grantsSelectedOrg,

        resolved,

        health: {
            ok: warnings.length === 0,
            warnings,
        },
    };
}

export async function GET(req: NextRequest) {
    const guard = await requireAccessHealthAdmin();

    if (!guard.ok) {
        return guard.response;
    }

    const q = clean(req.nextUrl.searchParams.get("q"))?.toLowerCase() ?? null;
    const authUserId = clean(req.nextUrl.searchParams.get("auth_user_id"));
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "25");
    const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), 100)
        : 25;

    const admin = supabaseAdmin();

    const usersRes = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
    });

    const users = usersRes.data.users ?? [];

    const filtered = users
        .filter((user) => {
            if (authUserId) return user.id === authUserId;
            if (!q) return true;

            return (
                String(user.email ?? "").toLowerCase().includes(q) ||
                String(user.id ?? "").toLowerCase().includes(q)
            );
        })
        .slice(0, limit);

    const rows = await Promise.all(
        filtered.map((user) =>
            buildHealthRow({
                auth_user_id: user.id,
                email: user.email ?? null,
                last_sign_in_at: (user.last_sign_in_at as string | null) ?? null,
            })
        )
    );

    return NextResponse.json(
        {
            ok: true,
            count: rows.length,
            rows,
        },
        { status: 200 }
    );
}