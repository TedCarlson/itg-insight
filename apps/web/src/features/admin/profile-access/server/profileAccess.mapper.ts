function firstEmail(emails: unknown): string | null {
  if (!emails) return null;

  if (Array.isArray(emails)) {
    const hit = emails.find((x) => typeof x === "string" && x.includes("@"));
    return hit ? String(hit).trim() : null;
  }

  if (typeof emails !== "string") return null;

  const raw = emails.trim();
  if (!raw) return null;

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      return firstEmail(JSON.parse(raw));
    } catch {
      // fall through
    }
  }

  return raw.split(/[,\s;]+/g).find((p) => p.includes("@")) ?? raw;
}

export function mapProfileAccessRows(args: {
  authUsers: any[];
  profiles: any[];
  pcOrgs: any[];
  eligibility: any[];
  grants: any[];
  people: any[];
  q: string;
  limit: number;
}) {
  const orgById = new Map<string, any>();
  for (const org of args.pcOrgs) orgById.set(String(org.pc_org_id), org);

  const profileByAuth = new Map<string, any>();
  for (const p of args.profiles) profileByAuth.set(String(p.auth_user_id), p);

  const personById = new Map<string, any>();
  for (const p of args.people) personById.set(String(p.person_id), p);

  const eligibilityByAuth = new Map<string, any[]>();
  for (const e of args.eligibility) {
    const key = String(e.auth_user_id);
    const list = eligibilityByAuth.get(key) ?? [];
    list.push(e);
    eligibilityByAuth.set(key, list);
  }

  const now = new Date();
  const grantsByAuth = new Map<string, any[]>();
  for (const g of args.grants) {
    if (g.revoked_at) continue;
    const exp = g.expires_at ? new Date(g.expires_at) : null;
    if (exp && exp <= now) continue;

    const key = String(g.auth_user_id);
    const list = grantsByAuth.get(key) ?? [];
    list.push(g);
    grantsByAuth.set(key, list);
  }

  const query = args.q.trim().toLowerCase();

  return args.authUsers
    .map((u: any) => {
      const auth_user_id = String(u.id);
      const profile = profileByAuth.get(auth_user_id) ?? null;
      const personId = profile?.core_person_id ?? profile?.person_id ?? null;
      const person = personId ? personById.get(String(personId)) ?? null : null;
      const selectedOrg = profile?.selected_pc_org_id
        ? orgById.get(String(profile.selected_pc_org_id)) ?? null
        : null;

      const org_access = (eligibilityByAuth.get(auth_user_id) ?? [])
        .map((e) => {
          const org = orgById.get(String(e.pc_org_id));
          return {
            pc_org_id: String(e.pc_org_id),
            pc_org_name: org?.pc_org_name ?? null,
            created_at: e.created_at ?? null,
            is_selected: String(profile?.selected_pc_org_id ?? "") === String(e.pc_org_id),
          };
        })
        .sort((a, b) => String(a.pc_org_name ?? "").localeCompare(String(b.pc_org_name ?? "")));

      const permissions = (grantsByAuth.get(auth_user_id) ?? []).map((g) => ({
        pc_org_id: String(g.pc_org_id),
        pc_org_name: orgById.get(String(g.pc_org_id))?.pc_org_name ?? null,
        permission_key: String(g.permission_key),
      }));

      return {
        auth_user_id,
        email: u.email ?? null,
        invited_at: u.invited_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,

        profile_status: profile?.status ?? null,
        selected_pc_org_id: profile?.selected_pc_org_id ?? null,
        selected_pc_org_name: selectedOrg?.pc_org_name ?? null,
        is_admin: profile?.is_admin === true,

        person_id: personId,
        person_full_name: person?.full_name ?? null,
        person_email: firstEmail(person?.emails),
        person_active: person?.active ?? null,

        org_access,
        org_access_count: org_access.length,
        permissions,
      };
    })
    .filter((row) => {
      if (!query) return true;

      const hay = [
        row.auth_user_id,
        row.email,
        row.profile_status,
        row.selected_pc_org_id,
        row.selected_pc_org_name,
        row.person_id,
        row.person_full_name,
        row.person_email,
        ...row.org_access.map((o) => o.pc_org_name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    })
    .slice(0, args.limit);
}
