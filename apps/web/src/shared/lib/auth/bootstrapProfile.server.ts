// path: apps/web/src/shared/lib/auth/bootstrapProfile.server.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

type BootstrapResult = {
  ok: boolean;
  auth_user_id: string;
  status: string | null;
  person_id: string | null;
  selected_pc_org_id: string | null;
  created: boolean;
  hydrated: boolean;
  full_name: string | null;
  is_owner: boolean;
  is_admin: boolean;
  is_app_owner: boolean;
  notes?: string[];
};

type UserProfileRow = {
  auth_user_id?: string | null;
  status?: string | null;
  person_id?: string | null;
  core_person_id?: string | null;
  selected_pc_org_id?: string | null;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: unknown): string | null {
  const next = asNonEmptyString(value);
  return next ? next.toLowerCase() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function resolveProfilePersonId(profile: UserProfileRow | null | undefined) {
  return (
    asNonEmptyString(profile?.person_id) ??
    asNonEmptyString(profile?.core_person_id)
  );
}

export async function bootstrapProfileServer(): Promise<BootstrapResult> {
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const appMeta = (user?.app_metadata ?? {}) as Record<string, unknown>;

  const fullName =
    asNonEmptyString(meta.full_name) ??
    asNonEmptyString(meta.name) ??
    asNonEmptyString(user?.email?.split("@")[0]) ??
    null;

  const isAppOwner =
    asBoolean(appMeta.is_app_owner) || asBoolean(meta.is_app_owner);

  const isOwner =
    isAppOwner || asBoolean(appMeta.is_owner) || asBoolean(meta.is_owner);

  const isAdmin = asBoolean(appMeta.is_admin) || asBoolean(meta.is_admin);

  if (!user || userErr) {
    return {
      ok: false,
      auth_user_id: "",
      status: null,
      person_id: null,
      selected_pc_org_id: null,
      created: false,
      hydrated: false,
      full_name: null,
      is_owner: false,
      is_admin: false,
      is_app_owner: false,
      notes: ["unauthorized"],
    };
  }

  const admin = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const notes: string[] = [];

  const authEmail = normalizeEmail(user.email);

  const existing = await admin
    .from("user_profile" as any)
    .select("auth_user_id, status, person_id, core_person_id, selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing.error) {
    return {
      ok: false,
      auth_user_id: user.id,
      status: null,
      person_id: null,
      selected_pc_org_id: null,
      created: false,
      hydrated: false,
      full_name: fullName,
      is_owner: isOwner,
      is_admin: isAdmin,
      is_app_owner: isAppOwner,
      notes: ["profile_select_failed", existing.error.message],
    };
  }

  let created = false;
  let hydrated = false;

  if (!existing.data) {
    const insert = await admin.from("user_profile" as any).upsert(
      {
        auth_user_id: user.id,
        status: "pending",
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "auth_user_id" as any, ignoreDuplicates: true }
    );

    if (insert.error) {
      return {
        ok: false,
        auth_user_id: user.id,
        status: null,
        person_id: null,
        selected_pc_org_id: null,
        created: false,
        hydrated: false,
        full_name: fullName,
        is_owner: isOwner,
        is_admin: isAdmin,
        is_app_owner: isAppOwner,
        notes: ["profile_insert_failed", insert.error.message],
      };
    }

    created = true;
  }

  const after = await admin
    .from("user_profile" as any)
    .select("auth_user_id, status, person_id, core_person_id, selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (after.error || !after.data) {
    return {
      ok: false,
      auth_user_id: user.id,
      status: null,
      person_id: null,
      selected_pc_org_id: null,
      created,
      hydrated: false,
      full_name: fullName,
      is_owner: isOwner,
      is_admin: isAdmin,
      is_app_owner: isAppOwner,
      notes: ["profile_reread_failed", after.error?.message ?? "no_row"],
    };
  }

  const profile = after.data as UserProfileRow;

  const metaPersonId = asNonEmptyString(meta.person_id);
  const metaPcOrgId =
    asNonEmptyString(meta.pc_org_id) ??
    asNonEmptyString(meta.selected_pc_org_id);
  const metaAssignmentId = asNonEmptyString(meta.assignment_id);

  let fallbackPersonId: string | null = null;
  let fallbackPcOrgId: string | null = null;

  const currentPersonId = resolveProfilePersonId(profile);

  if (!currentPersonId && authEmail) {
    const personMatch = await admin
      .from("person" as any)
      .select("person_id, id, email")
      .eq("email", authEmail);

    if (!personMatch.error) {
      const rows = Array.isArray(personMatch.data) ? personMatch.data : [];
      if (rows.length === 1) {
        fallbackPersonId =
          asNonEmptyString(rows[0]?.person_id) ?? asNonEmptyString(rows[0]?.id);
      }
    }
  }

  const resolvedPersonId = currentPersonId ?? metaPersonId ?? fallbackPersonId;

  if (!profile.selected_pc_org_id && !metaPcOrgId && resolvedPersonId) {
    const membership = await admin
      .from("person_pc_org" as any)
      .select("pc_org_id")
      .eq("person_id", resolvedPersonId)
      .limit(1);

    if (!membership.error) {
      const row = Array.isArray(membership.data) ? membership.data[0] : null;
      fallbackPcOrgId = asNonEmptyString(row?.pc_org_id);
    }
  }

  const patch: Record<string, unknown> = { updated_at: nowIso };

  if (!currentPersonId) {
    const chosen = metaPersonId ?? fallbackPersonId;
    if (chosen) patch.person_id = chosen;
  }

  if (!profile.selected_pc_org_id) {
    const chosen = metaPcOrgId ?? fallbackPcOrgId;
    if (chosen) patch.selected_pc_org_id = chosen;
  }

  if (
    profile.status !== "active" &&
    (metaAssignmentId || metaPersonId || fallbackPersonId)
  ) {
    patch.status = "active";
  }

  const hasMeaningfulPatch = Object.keys(patch).some(
    (key) => key !== "updated_at"
  );

  if (hasMeaningfulPatch) {
    await admin
      .from("user_profile" as any)
      .update(patch)
      .eq("auth_user_id", user.id);

    hydrated = true;
  }

  const final = await admin
    .from("user_profile" as any)
    .select("auth_user_id, status, person_id, core_person_id, selected_pc_org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const finalProfile = ((final.data as UserProfileRow | null) ?? profile);
  const finalPersonId = resolveProfilePersonId(finalProfile);

  return {
    ok: true,
    auth_user_id: user.id,
    status: finalProfile.status ?? null,
    person_id: finalPersonId,
    selected_pc_org_id: finalProfile.selected_pc_org_id ?? null,
    created,
    hydrated,
    full_name: fullName,
    is_owner: isOwner,
    is_admin: isAdmin,
    is_app_owner: isAppOwner,
    notes,
  };
}