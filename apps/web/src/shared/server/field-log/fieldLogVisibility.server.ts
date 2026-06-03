import { isTechExperienceUser } from "@/shared/access/access";

export const FIELD_LOG_ACTIVE_STATUSES = [
  "pending_review",
  "tech_followup_required",
  "sup_followup_required",
] as const;

export type FieldLogVisibilityRow = {
  created_by_user_id?: string | null;
  tech_person_id?: string | null;
};

type WorkforceAffiliationRow = {
  person_id: string;
  affiliation_id: string | null;
  affiliation_code: string | null;
};

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

export function isFieldLogGlobalCompanyUser(accessPass: any) {
  const permissions = Array.isArray(accessPass?.permissions) ? accessPass.permissions : [];

  return (
    accessPass?.is_admin === true ||
    accessPass?.is_owner === true ||
    accessPass?.is_app_owner === true ||
    permissions.includes("leadership_manage") ||
    permissions.includes("permissions_manage") ||
    permissions.includes("org_console_manage") ||
    permissions.includes("admin_console_manage")
  );
}

export async function applyFieldLogVisibility<T extends FieldLogVisibilityRow>(args: {
  supabase: any;
  pcOrgId: string;
  accessPass: any;
  rows: T[];
}) {
  const { supabase, pcOrgId, accessPass, rows } = args;

  if (rows.length === 0) return rows;

  if (isFieldLogGlobalCompanyUser(accessPass)) {
    return rows;
  }

  const viewerPersonId = clean(accessPass?.person_id);
  const authUserId = clean(accessPass?.auth_user_id);
  const isTechUser = isTechExperienceUser(accessPass);

  const personIds = Array.from(
    new Set(
      [
        viewerPersonId,
        ...rows.map((row) => clean(row.tech_person_id)),
      ].filter(Boolean) as string[],
    ),
  );

  const affiliationByPersonId = new Map<string, WorkforceAffiliationRow>();

  if (personIds.length > 0) {
    const { data, error } = await supabase
      .from("workforce_current_v")
      .select("person_id,affiliation_id,affiliation_code")
      .eq("pc_org_id", pcOrgId)
      .in("person_id", personIds);

    if (error) {
      throw new Error(error.message || "Failed to resolve Field Log visibility.");
    }

    for (const row of (data ?? []) as WorkforceAffiliationRow[]) {
      affiliationByPersonId.set(String(row.person_id), row);
    }
  }

  const viewerAffiliation = viewerPersonId
    ? affiliationByPersonId.get(viewerPersonId)
    : null;

  const viewerAffiliationId = clean(viewerAffiliation?.affiliation_id);
  const viewerAffiliationCode = clean(viewerAffiliation?.affiliation_code);

  if (isTechUser) {
    return rows.filter((row) => {
      const createdByViewer = clean(row.created_by_user_id) === authUserId;
      const linkedToViewer =
        !!viewerPersonId && clean(row.tech_person_id) === viewerPersonId;

      return createdByViewer || linkedToViewer;
    });
  }

  if (viewerAffiliationCode === "ITG") {
    return rows;
  }

  return rows.filter((row) => {
    const createdByViewer = clean(row.created_by_user_id) === authUserId;
    const techPersonId = clean(row.tech_person_id);
    const techAffiliation = techPersonId ? affiliationByPersonId.get(techPersonId) : null;
    const techAffiliationId = clean(techAffiliation?.affiliation_id);

    return (
      createdByViewer ||
      (!!viewerAffiliationId && techAffiliationId === viewerAffiliationId)
    );
  });
}
