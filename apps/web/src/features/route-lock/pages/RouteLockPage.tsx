import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";

// IMPORTANT: use admin for reads (avoids RLS filtering facts to empty)
import { supabaseAdmin } from "@/shared/data/supabase/admin";

import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import { getRouteLockDaysForCurrentFiscalMonth } from "@/features/route-lock/calendar/lib/getRouteLockDays.server";
import { RouteLockSevenDayClient } from "@/features/route-lock/landing/RouteLockSevenDayClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RouteLockPage() {
  noStore();

  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) redirect("/home");

  const sb = supabaseAdmin(); // admin reads
  const pc_org_id = scope.selected_pc_org_id;

  const res = await getRouteLockDaysForCurrentFiscalMonth(sb, pc_org_id);

  const today = todayInNY();
  const next7 = res.ok ? res.days.filter((d) => d.date >= today).slice(0, 7) : [];

  return <RouteLockSevenDayClient days={next7} />;
}