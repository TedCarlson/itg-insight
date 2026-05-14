import type { SupabaseAdminClient } from "../types/dispatchLog.types";

export async function loadDispatchUserLabels(
  admin: SupabaseAdminClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const out = new Map<string, string>();

  for (const uid of ids) {
    try {
      const { data: prof } = await admin
        .from("user_profile")
        .select("person_id")
        .eq("auth_user_id", uid)
        .maybeSingle();

      const personId = prof?.person_id ? String(prof.person_id) : null;

      if (personId) {
        const { data: person } = await admin
          .from("person")
          .select("full_name")
          .eq("person_id", personId)
          .maybeSingle();

        const name = person?.full_name ? String(person.full_name).trim() : "";
        if (name) {
          out.set(uid, name);
          continue;
        }
      }
    } catch {}

    try {
      const { data, error } = await admin.auth.admin.getUserById(uid);
      if (!error) {
        const email = (data?.user?.email ?? null) as string | null;
        if (email) {
          out.set(uid, email);
          continue;
        }
      }
    } catch {}

    out.set(uid, uid);
  }

  return out;
}