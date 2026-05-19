import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
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

  const sb = supabaseAdmin();
  const pc_org_id = scope.selected_pc_org_id;

  const res = await getRouteLockDaysForCurrentFiscalMonth(sb, pc_org_id);
  const today = todayInNY();

  return <RouteLockSevenDayClient days={res.ok ? res.days : []} todayIso={today} />;
}