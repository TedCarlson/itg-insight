import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import { getRouteLockDaysForRange } from "@/features/route-lock/calendar/lib/getRouteLockDays.server";
import { RouteLockSevenDayClient } from "@/features/route-lock/landing/RouteLockSevenDayClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sundayForISO(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function normalizeDate(value: unknown): string | null {
  const raw = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export default async function RouteLockPage(props: {
  searchParams?: Promise<{ weekEnding?: string }>;
}) {
  noStore();

  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) redirect("/home");

  const searchParams = await props.searchParams;
  const today = todayInNY();
  const requestedDate = normalizeDate(searchParams?.weekEnding) ?? today;
  const weekStart = sundayForISO(requestedDate);
  const weekEnd = addDaysISO(weekStart, 6);

  const sb = supabaseAdmin();
  const res = await getRouteLockDaysForRange(
    sb,
    scope.selected_pc_org_id,
    weekStart,
    weekEnd
  );

  return (
    <RouteLockSevenDayClient
      days={res.ok ? res.days : []}
      weekStart={weekStart}
      weekEnd={weekEnd}
    />
  );
}
