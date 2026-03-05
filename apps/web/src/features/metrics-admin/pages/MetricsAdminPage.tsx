// RUN THIS
// Replace the entire file:
// apps/web/src/features/metrics-admin/pages/MetricsAdminPage.tsx

import { redirect } from "next/navigation";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

import MetricsConsoleGrid from "@/features/metrics-admin/components/MetricsConsoleGrid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type InitialPayload = {
  kpiDefs: any[];
  classConfig: any[];
  rubricRows: any[];
};

async function isOwner(sb: any) {
  try {
    const { data, error } = await sb.rpc("is_owner");
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

async function hasAnyRole(admin: any, auth_user_id: string, roleKeys: string[]) {
  const { data, error } = await admin.from("user_roles").select("role_key").eq("auth_user_id", auth_user_id);
  if (error) return false;
  const roles = (data ?? []).map((r: any) => String(r?.role_key ?? "")).filter(Boolean);
  return roles.some((rk: string) => roleKeys.includes(rk));
}

export default async function MetricsAdminPage() {
  const sb = await supabaseServer();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  // ✅ Admin+ OR Owner gate (matches your “admin + owner always” requirement)
  const admin = supabaseAdmin();
  const owner = await isOwner(sb);
  const elevated = owner || (await hasAnyRole(admin, user.id, ["admin", "dev", "director", "vp"]));
  if (!elevated) redirect("/");

  // ✅ Use service role reads (stable; avoids future RLS drift)
  const [{ data: kpiDefs }, { data: classConfig }, { data: rubData }] = await Promise.all([
    admin.from("metrics_kpi_def").select("*").order("kpi_key"),
    admin.from("metrics_class_kpi_config").select("*").order("class_type").order("kpi_key"),
    // ✅ Hydrate legacy rows: treat NULL as active
    admin
      .from("metrics_kpi_rubric")
      .select("*")
      .or("is_active.is.null,is_active.eq.true")
      .order("kpi_key")
      .order("band_key"),
  ]);

  const initial: InitialPayload = {
    kpiDefs: kpiDefs ?? [],
    classConfig: classConfig ?? [],
    rubricRows: rubData ?? [],
  };

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Metrics Console</h1>
        <p className="text-sm text-muted-foreground">
          Configure KPI rubric ranges (global by KPI) and KPI inclusion/weights by class.
        </p>
      </header>

      <MetricsConsoleGrid initial={initial} />
    </div>
  );
}