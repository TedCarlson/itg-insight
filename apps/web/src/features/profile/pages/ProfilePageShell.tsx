// path: apps/web/src/features/profile/pages/ProfilePageShell.tsx

import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

type AssignmentRow = {
  person_id: string | null;
  pc_org_id: string | null;
  tech_id: string | null;
  position_title: string | null;
  role_type: string | null;
  active_flag: boolean | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
};

type GrantRow = {
  pc_org_id: string | null;
  permission_key: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

type MembershipRow = {
  person_id: string | null;
  pc_org_id: string | null;
  status: string | null;
  active: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

type CompanyCoverageRow = {
  contractor_assignment_id: string | null;
  contractor_id: string | null;
  contractor_name: string | null;
  contractor_code: string | null;
  pc_org_id: string | null;
  pc_org_name: string | null;
  region_id: string | null;
  workspace_id: string | null;
  workspace_key: string | null;
  workspace_name: string | null;
  workspace_status: string | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean | null;
};

function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next || null;
}

function fmt(value: unknown) {
  return clean(value) ?? "—";
}

function fmtDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function resolveRole(assignments: AssignmentRow[]) {
  const titles = new Set(
    assignments
      .filter((row) => row.active_flag === true)
      .map((row) => clean(row.position_title))
      .filter(Boolean)
  );

  if (
    titles.has("Director") ||
    titles.has("Regional Director") ||
    titles.has("Senior Director")
  ) {
    return { role: "DIRECTOR", home: "/director/executive" };
  }

  if (titles.has("BP Owner")) {
    return { role: "BP_OWNER", home: "/home" };
  }

  if (titles.has("BP Lead")) {
    return { role: "BP_LEAD", home: "/home" };
  }

  if (titles.has("BP Supervisor")) {
    return { role: "BP_SUPERVISOR", home: "/home" };
  }

  if (
    titles.has("Manager") ||
    titles.has("Project Manager") ||
    titles.has("Regional Manager")
  ) {
    return { role: "COMPANY_MANAGER", home: "/home" };
  }

  if (titles.has("ITG Supervisor")) {
    return { role: "ITG_SUPERVISOR", home: "/home" };
  }

  if (titles.has("Technician")) {
    return { role: "TECH", home: "/home" };
  }

  return { role: "UNKNOWN", home: null };
}

function statusBadge(status: string | null) {
  if (status === "active") return "success";
  if (status === "inactive" || status === "disabled") return "warning";
  return "neutral";
}

function HealthLine({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
      <span>{children}</span>
      <Badge variant={ok ? "success" : "warning"}>
        {ok ? "OK" : "Needs attention"}
      </Badge>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
        {label}
      </div>
      <div
        className={
          mono
            ? "break-all font-mono text-xs text-[var(--to-ink-muted)]"
            : "text-sm"
        }
      >
        {value}
      </div>
    </div>
  );
}

export default async function ProfilePageShell() {
  noStore();

  const userClient = await supabaseServer();
  const admin = supabaseAdmin();

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await admin
    .from("user_profile")
    .select(
      "auth_user_id, person_id, core_person_id, status, selected_pc_org_id, is_admin, created_at, updated_at"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const legacyPersonId = clean((profile as any)?.person_id);
  const corePersonId = clean((profile as any)?.core_person_id);
  const effectivePersonId = corePersonId ?? legacyPersonId;
  const selectedPcOrgId = clean((profile as any)?.selected_pc_org_id);

  const [{ data: appOwner }, { data: person }, { data: selectedOrg }] =
    await Promise.all([
      admin
        .from("app_owners")
        .select("auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle(),

      effectivePersonId
        ? admin
            .from("v_person_core")
            .select(
              "person_id, full_name, emails, mobile, active, role, co_ref_id, co_code"
            )
            .eq("person_id", effectivePersonId)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),

      selectedPcOrgId
        ? admin
            .from("pc_org")
            .select("pc_org_id, pc_org_name, region_id")
            .eq("pc_org_id", selectedPcOrgId)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

  const personCoRefId = clean((person as any)?.co_ref_id);

  const [{ data: contractor }, { data: companyCoverageRaw }] =
    await Promise.all([
      personCoRefId
        ? admin
            .from("contractor_admin_v")
            .select("contractor_id, contractor_name, contractor_code")
            .eq("contractor_id", personCoRefId)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),

      personCoRefId
        ? admin
            .from("v_contractor_workspace_assignment")
            .select(
              `
                contractor_assignment_id,
                contractor_id,
                contractor_name,
                contractor_code,
                pc_org_id,
                pc_org_name,
                region_id,
                workspace_id,
                workspace_key,
                workspace_name,
                workspace_status,
                start_date,
                end_date,
                active
              `
            )
            .eq("contractor_id", personCoRefId)
        : Promise.resolve({ data: [] } as any),
    ]);

  const companyCoverage = (companyCoverageRaw ?? []) as CompanyCoverageRow[];

  const [{ data: membershipsRaw }, { data: assignmentsRaw }, { data: grantsRaw }] =
    await Promise.all([
      effectivePersonId
        ? admin
            .from("v_person_workspace_membership")
            .select(
              `
                person_id,
                pc_org_id,
                pc_org_name,
                region_id,
                workspace_id,
                workspace_key,
                workspace_name,
                workspace_status,
                membership_status,
                membership_active,
                start_date,
                end_date
              `
            )
            .eq("person_id", effectivePersonId)
        : Promise.resolve({ data: [] } as any),

      effectivePersonId && selectedPcOrgId
        ? admin
            .from("company_profile_fact")
            .select(
              `
                person_id,
                pc_org_id,
                tech_id,
                position_title,
                role_type,
                active_flag,
                effective_start_date,
                effective_end_date
              `
            )
            .eq("person_id", effectivePersonId)
            .eq("pc_org_id", selectedPcOrgId)
            .is("effective_end_date", null)
        : Promise.resolve({ data: [] } as any),

      selectedPcOrgId
        ? admin
            .from("pc_org_permission_grant")
            .select(
              `
                pc_org_id,
                permission_key,
                expires_at,
                revoked_at
              `
            )
            .eq("auth_user_id", user.id)
            .eq("pc_org_id", selectedPcOrgId)
        : Promise.resolve({ data: [] } as any),
    ]);

  const memberships = (membershipsRaw ?? []) as Array<
    MembershipRow & {
      pc_org_name?: string | null;
      region_id?: string | null;
      workspace_id?: string | null;
      workspace_key?: string | null;
      workspace_name?: string | null;
      workspace_status?: string | null;
      membership_status?: string | null;
      membership_active?: boolean | null;
    }
  >;

  const membershipPcOrgIds = Array.from(
    new Set(
      memberships
        .map((row) => clean(row.pc_org_id))
        .filter(Boolean) as string[]
    )
  );

  const activeCompanyCoveragePcOrgIds = Array.from(
    new Set(
      companyCoverage
        .filter((row) => row.active === true)
        .map((row) => clean(row.pc_org_id))
        .filter(Boolean) as string[]
    )
  );

  const assignments = ((assignmentsRaw ?? []) as AssignmentRow[]).filter(
    (row) => row.active_flag === true
  );

  const grants = ((grantsRaw ?? []) as GrantRow[]).filter(
    (row) => !row.revoked_at
  );

  const resolved = resolveRole(assignments);

  const selectedOrgAllowedByMembership = Boolean(
    selectedPcOrgId && membershipPcOrgIds.includes(selectedPcOrgId)
  );

  const selectedOrgAllowedByCompanyCoverage = Boolean(
    selectedPcOrgId && activeCompanyCoveragePcOrgIds.includes(selectedPcOrgId)
  );

  const selectedOrgAllowed =
    selectedOrgAllowedByMembership || selectedOrgAllowedByCompanyCoverage;

  const health = {
    profile: Boolean(profile),
    activeProfile: clean((profile as any)?.status) === "active",
    person: Boolean(person),
    selectedOrg: Boolean(selectedPcOrgId),
    selectedOrgAllowed,
    assignment: assignments.length > 0,
    grants: grants.length > 0,
    role: resolved.role !== "UNKNOWN",
  };

  return (
    <PageShell>
      <PageHeader
        title="My Profile"
        subtitle="Your app identity, operating scope, role resolution, and access health."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <Card className="grid gap-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Identity Summary</div>
                <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                  This is the identity chain the app currently recognizes.
                </div>
              </div>

              <Badge variant={health.role ? "success" : "warning"}>
                {resolved.role}
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <InfoRow label="Signed-in email" value={fmt(user.email)} />
              <InfoRow label="Auth user id" value={user.id} mono />
              <InfoRow
                label="Profile status"
                value={
                  <Badge variant={statusBadge(clean((profile as any)?.status))}>
                    {fmt((profile as any)?.status)}
                  </Badge>
                }
              />
              <InfoRow
                label="Resolved home"
                value={resolved.home ?? "No resolved home yet"}
              />
            </div>
          </Card>

          <Card className="grid gap-4 p-4">
            <div>
              <div className="text-sm font-semibold">Core Person</div>
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                Core person is the operational person record used by workforce,
                reporting, and role scope.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <InfoRow
                label="Full name"
                value={fmt((person as any)?.full_name)}
              />
              <InfoRow
                label="Person email"
                value={fmt((person as any)?.emails)}
              />
              <InfoRow
                label="Core person id"
                value={fmt((person as any)?.person_id)}
                mono
              />
              <InfoRow
                label="Legacy person id"
                value={fmt(legacyPersonId)}
                mono
              />
              <InfoRow
                label="Company / Contractor"
                value={fmt(
                  (contractor as any)?.contractor_name ??
                    (person as any)?.co_code
                )}
              />
              <InfoRow
                label="Company ref id"
                value={fmt(personCoRefId)}
                mono
              />
            </div>
          </Card>

          <Card className="grid gap-4 p-4">
            <div>
              <div className="text-sm font-semibold">Selected Operating Org</div>
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                This is the currently selected org used by role pages and
                workspace filters.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <InfoRow
                label="Selected org"
                value={fmt((selectedOrg as any)?.pc_org_name)}
              />
              <InfoRow
                label="Selected pc_org_id"
                value={fmt(selectedPcOrgId)}
                mono
              />
              <InfoRow
                label="Region id"
                value={fmt((selectedOrg as any)?.region_id)}
                mono
              />
              <InfoRow
                label="Scope source"
                value={
                  selectedOrgAllowedByMembership
                    ? "Personal membership"
                    : selectedOrgAllowedByCompanyCoverage
                      ? "Company coverage"
                      : "No matching scope"
                }
              />
            </div>
          </Card>

          <Card className="grid gap-4 p-4">
            <div>
              <div className="text-sm font-semibold">Operating Memberships</div>
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                These are the PC-org memberships currently linked directly to
                your core person identity.
              </div>
            </div>

            {memberships.length ? (
              <div className="overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[1fr_1fr_0.8fr] bg-[var(--to-surface-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
                  <div>Org</div>
                  <div>Status</div>
                  <div>Active</div>
                </div>

                {memberships.map((row, index) => {
                  const orgId = clean(row.pc_org_id);

                  return (
                    <div
                      key={`${orgId ?? "membership"}-${index}`}
                      className="grid grid-cols-[1fr_1fr_0.8fr] border-t px-3 py-2 text-sm"
                    >
                      <div>
                        <div>{fmt(row.pc_org_name)}</div>
                        <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">
                          {fmt(orgId)}
                        </div>
                        <div className="text-[11px] text-[var(--to-ink-muted)]">
                          Workspace: {fmt(row.workspace_name)}
                        </div>
                      </div>
                      <div>{fmt(row.membership_status)}</div>
                      <div>{row.membership_active === true ? "Yes" : "No"}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--to-surface-soft)] p-3 text-sm text-[var(--to-ink-muted)]">
                No operating memberships were found for this core person.
              </div>
            )}
          </Card>

          <Card className="grid gap-4 p-4">
            <div>
              <div className="text-sm font-semibold">Company Coverage</div>
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                These are the operating orgs covered by your contractor/company
                association.
              </div>
            </div>

            {companyCoverage.length ? (
              <div className="overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[1fr_1fr_0.8fr] bg-[var(--to-surface-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
                  <div>Org</div>
                  <div>Workspace</div>
                  <div>Active</div>
                </div>

                {companyCoverage.map((row, index) => (
                  <div
                    key={`${row.contractor_assignment_id ?? "coverage"}-${index}`}
                    className="grid grid-cols-[1fr_1fr_0.8fr] border-t px-3 py-2 text-sm"
                  >
                    <div>
                      <div>{fmt(row.pc_org_name)}</div>
                      <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">
                        {fmt(row.pc_org_id)}
                      </div>
                    </div>
                    <div>
                      <div>{fmt(row.workspace_name)}</div>
                      <div className="text-[11px] text-[var(--to-ink-muted)]">
                        {fmt(row.workspace_status)}
                      </div>
                    </div>
                    <div>{row.active === true ? "Yes" : "No"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--to-surface-soft)] p-3 text-sm text-[var(--to-ink-muted)]">
                No company coverage was found for this core person.
              </div>
            )}
          </Card>

          <Card className="grid gap-4 p-4">
            <div>
              <div className="text-sm font-semibold">Assignments</div>
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                Active role records in the selected operating org.
              </div>
            </div>

            {assignments.length ? (
              <div className="overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[1fr_1fr_1fr] bg-[var(--to-surface-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
                  <div>Position</div>
                  <div>Seat</div>
                  <div>Tech ID</div>
                </div>

                {assignments.map((row, index) => (
                  <div
                    key={`${row.tech_id ?? "assignment"}-${index}`}
                    className="grid grid-cols-[1fr_1fr_1fr] border-t px-3 py-2 text-sm"
                  >
                    <div>{fmt(row.position_title)}</div>
                    <div>{fmt(row.role_type)}</div>
                    <div>{fmt(row.tech_id)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--to-surface-soft)] p-3 text-sm text-[var(--to-ink-muted)]">
                No active assignment was found for this selected org.
              </div>
            )}
          </Card>

          <Card className="grid gap-4 p-4">
            <div>
              <div className="text-sm font-semibold">Permission Grants</div>
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                Permission grants control module/action access inside the
                selected org.
              </div>
            </div>

            {grants.length ? (
              <div className="flex flex-wrap gap-2">
                {grants.map((grant) => (
                  <Badge key={grant.permission_key ?? "grant"} variant="info">
                    {grant.permission_key}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--to-surface-soft)] p-3 text-sm text-[var(--to-ink-muted)]">
                No active permission grants found for the selected org.
              </div>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card className="grid gap-3 p-4">
            <div>
              <div className="text-sm font-semibold">Access Health</div>
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                Share this section with an app admin when access does not look
                right.
              </div>
            </div>

            <HealthLine ok={health.profile}>User profile exists</HealthLine>
            <HealthLine ok={health.activeProfile}>Profile is active</HealthLine>
            <HealthLine ok={health.person}>Core person is linked</HealthLine>
            <HealthLine ok={health.selectedOrg}>Selected org is set</HealthLine>
            <HealthLine ok={health.selectedOrgAllowed}>
              Selected org is in membership or company coverage
            </HealthLine>
            <HealthLine ok={health.assignment}>
              Active assignment found
            </HealthLine>
            <HealthLine ok={health.role}>Role is resolved</HealthLine>
            <HealthLine ok={health.grants}>Permission grants found</HealthLine>
          </Card>

          <Card className="grid gap-3 p-4">
            <div className="text-sm font-semibold">Flags</div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={(profile as any)?.is_admin ? "info" : "neutral"}>
                {(profile as any)?.is_admin ? "App admin" : "Standard user"}
              </Badge>

              <Badge variant={appOwner?.auth_user_id ? "info" : "neutral"}>
                {appOwner?.auth_user_id ? "App owner" : "Not app owner"}
              </Badge>
            </div>
          </Card>

          <Card className="grid gap-2 p-4">
            <div className="text-sm font-semibold">Audit</div>
            <InfoRow
              label="Profile created"
              value={fmtDate((profile as any)?.created_at)}
            />
            <InfoRow
              label="Profile updated"
              value={fmtDate((profile as any)?.updated_at)}
            />
          </Card>
        </div>
      </div>
    </PageShell>
  );
}