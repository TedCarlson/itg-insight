// path: apps/web/src/features/tech/lib/getTechShellContext.ts

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type TechShellContext = {
  ok: boolean;
  pc_org_id: string | null;
  person_id: string | null;
  assignment_id: string | null;
  reason: "ok" | "no_org" | "no_auth_user" | "no_person" | "no_active_assignment";
};

type WorkforceRow = {
  assignment_id: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim() || null;
}

export async function getTechShellContext(): Promise<TechShellContext> {
  const scope = await requireSelectedPcOrgServer();

  if (!scope.ok) {
    return {
      ok: false,
      pc_org_id: null,
      person_id: null,
      assignment_id: null,
      reason: scope.reason === "not_authenticated" ? "no_auth_user" : "no_org",
    };
  }

  const pc_org_id = scope.selected_pc_org_id;
  const person_id = clean(scope.boot.person_id);

  if (!scope.boot.ok) {
    return {
      ok: false,
      pc_org_id,
      person_id: null,
      assignment_id: null,
      reason: "no_auth_user",
    };
  }

  if (!person_id) {
    return {
      ok: false,
      pc_org_id,
      person_id: null,
      assignment_id: null,
      reason: "no_person",
    };
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("workforce_current_v")
    .select("assignment_id")
    .eq("pc_org_id", pc_org_id)
    .eq("person_id", person_id)
    .eq("is_active", true)
    .eq("assignment_status", "active")
    .limit(1)
    .maybeSingle<WorkforceRow>();

  if (error) {
    throw new Error(`tech workforce assignment lookup failed: ${error.message}`);
  }

  const assignment_id = clean(data?.assignment_id);

  if (!assignment_id) {
    return {
      ok: false,
      pc_org_id,
      person_id,
      assignment_id: null,
      reason: "no_active_assignment",
    };
  }

  return {
    ok: true,
    pc_org_id,
    person_id,
    assignment_id,
    reason: "ok",
  };
}
