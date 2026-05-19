type PersonRepairReason =
  | "missing_prospecting_affiliation"
  | "mismatched_prospecting_affiliation";

export type PersonRepairRow = {
  repair_key: string;

  person_id: string;
  full_name: string | null;
  person_status: string | null;
  prospecting_affiliation_id: string | null;

  assignment_id: string | null;
  pc_org_id: string | null;
  pc_org_name: string | null;
  tech_id: string | null;
  position_title: string | null;
  role_type: string | null;

  affiliation_id: string;
  affiliation_code: string | null;
  affiliation: string | null;

  assignment_status: string | null;
  is_active: boolean | null;

  start_date: string | null;
  end_date: string | null;

  reasons: PersonRepairReason[];
};

type QueryInput = {
  q?: string | null;
  limit?: number;
};

type MutateInput = {
  action: string;
  person_id?: string | null;
  affiliation_id?: string | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function fail(error: string, status = 400) {
  return { ok: false as const, error, status };
}

function matchesSearch(row: PersonRepairRow, q: string) {
  if (!q) return true;

  const haystack = [
    row.full_name,
    row.tech_id,
    row.pc_org_name,
    row.affiliation,
    row.affiliation_code,
    row.position_title,
    row.role_type,
  ]
    .map((v) => clean(v).toLowerCase())
    .join(" ");

  return haystack.includes(q.toLowerCase());
}

function repairReasons(args: {
  workforceAffiliationId: string | null;
  prospectingAffiliationId: string | null;
}): PersonRepairReason[] {
  const workforceAffiliationId = clean(args.workforceAffiliationId);
  const prospectingAffiliationId = clean(args.prospectingAffiliationId);

  if (!workforceAffiliationId) return [];

  if (!prospectingAffiliationId) {
    return ["missing_prospecting_affiliation"];
  }

  if (workforceAffiliationId !== prospectingAffiliationId) {
    return ["mismatched_prospecting_affiliation"];
  }

  return [];
}

export async function getPersonRepairPayload(admin: any, input: QueryInput = {}) {
  const limit = Math.min(Math.max(Number(input.limit ?? 250), 1), 1000);
  const q = clean(input.q);

  const workforceRes = await admin
    .from("workforce_current_v")
    .select(`
      assignment_id,
      person_id,
      pc_org_id,
      tech_id,
      full_name,
      person_status,
      affiliation_id,
      affiliation_code,
      affiliation,
      position_title,
      role_type,
      assignment_status,
      start_date,
      end_date,
      is_active
    `)
    .eq("is_active", true)
    .eq("assignment_status", "active")
    .not("affiliation_id", "is", null)
    .limit(2000);

  if (workforceRes.error) {
    return fail(workforceRes.error.message, 500);
  }

  const workforceRows = (workforceRes.data ?? []) as any[];

  const personIds = Array.from(
    new Set(
      workforceRows
        .map((row) => clean(row.person_id))
        .filter(Boolean),
    ),
  );

  const orgIds = Array.from(
    new Set(
      workforceRows
        .map((row) => clean(row.pc_org_id))
        .filter(Boolean),
    ),
  );

  const [peopleRes, orgsRes] = await Promise.all([
    personIds.length
      ? admin
          .from("v_person_core")
          .select("person_id,prospecting_affiliation_id,active,full_name")
          .in("person_id", personIds)
      : Promise.resolve({ data: [], error: null }),

    orgIds.length
      ? admin
          .from("pc_org")
          .select("pc_org_id,pc_org_name")
          .in("pc_org_id", orgIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (peopleRes.error) return fail(peopleRes.error.message, 500);
  if (orgsRes.error) return fail(orgsRes.error.message, 500);

  const peopleById = new Map(
    ((peopleRes.data ?? []) as any[]).map((row) => [
      clean(row.person_id),
      row,
    ]),
  );

  const orgNameById = new Map(
    ((orgsRes.data ?? []) as any[]).map((row) => [
      clean(row.pc_org_id),
      row.pc_org_name ?? null,
    ]),
  );

  const rows: PersonRepairRow[] = [];

  for (const row of workforceRows) {
    const personId = clean(row.person_id);
    const affiliationId = clean(row.affiliation_id);
    const person = peopleById.get(personId) ?? null;

    if (!personId || !affiliationId) continue;

    const reasons = repairReasons({
      workforceAffiliationId: affiliationId,
      prospectingAffiliationId: person?.prospecting_affiliation_id ?? null,
    });

    if (!reasons.length) continue;

    const repairRow: PersonRepairRow = {
      repair_key: `${personId}:${clean(row.assignment_id)}:${affiliationId}`,

      person_id: personId,
      full_name: row.full_name ?? person?.full_name ?? null,
      person_status: row.person_status ?? (person?.active === true ? "active" : null),
      prospecting_affiliation_id: person?.prospecting_affiliation_id ?? null,

      assignment_id: row.assignment_id ?? null,
      pc_org_id: row.pc_org_id ?? null,
      pc_org_name: orgNameById.get(clean(row.pc_org_id)) ?? null,
      tech_id: row.tech_id ?? null,
      position_title: row.position_title ?? null,
      role_type: row.role_type ?? null,

      affiliation_id: affiliationId,
      affiliation_code: row.affiliation_code ?? null,
      affiliation: row.affiliation ?? null,

      assignment_status: row.assignment_status ?? null,
      is_active: row.is_active ?? null,

      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,

      reasons,
    };

    if (matchesSearch(repairRow, q)) {
      rows.push(repairRow);
    }
  }

  const sorted = rows
    .sort((a, b) => {
      const orgDelta = clean(a.pc_org_name).localeCompare(clean(b.pc_org_name));
      if (orgDelta !== 0) return orgDelta;

      const affiliationDelta = clean(a.affiliation).localeCompare(clean(b.affiliation));
      if (affiliationDelta !== 0) return affiliationDelta;

      return clean(a.full_name).localeCompare(clean(b.full_name));
    })
    .slice(0, limit);

  return {
    ok: true as const,
    status: 200,
    summary: {
      pending: rows.length,
      shown: sorted.length,
    },
    rows: sorted,
  };
}

export async function mutatePersonRepair(
  admin: any,
  actorAuthUserId: string,
  input: MutateInput,
) {
  if (input.action !== "apply_workforce_affiliation") {
    return fail("unknown_action");
  }

  const personId = clean(input.person_id);
  const affiliationId = clean(input.affiliation_id);

  if (!personId) return fail("missing_person_id");
  if (!affiliationId) return fail("missing_affiliation_id");

  const validationRes = await admin
    .from("workforce_current_v")
    .select("person_id,affiliation_id,is_active,assignment_status")
    .eq("person_id", personId)
    .eq("affiliation_id", affiliationId)
    .eq("is_active", true)
    .eq("assignment_status", "active")
    .limit(1);

  if (validationRes.error) {
    return fail(validationRes.error.message, 500);
  }

  if (!(validationRes.data ?? []).length) {
    return fail("no_active_workforce_row_for_affiliation", 409);
  }

  const updateRes = await admin
    .rpc("admin_set_person_prospecting_affiliation", {
      p_person_id: personId,
      p_affiliation_id: affiliationId,
      p_actor_auth_user_id: actorAuthUserId,
    });

  if (updateRes.error) {
    return fail(updateRes.error.message, 500);
  }

  return {
    ok: true as const,
    status: 200,
    row: (updateRes.data ?? [])[0] ?? null,
  };
}
