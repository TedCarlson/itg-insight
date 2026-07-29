// path: apps/web/src/features/role-director/pages/DirectorRouteLockPageShell.tsx

import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PageShell } from "@/components/ui/PageShell";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { DirectorWorkspaceSelector } from "@/shared/surfaces/navigation/DirectorWorkspaceSelector";

import RouteLockSubnav from "@/features/route-lock/components/RouteLockSubnav";
import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import { getRouteLockDaysForRange } from "@/features/route-lock/calendar/lib/getRouteLockDays.server";
import { RouteLockSevenDayClient } from "@/features/route-lock/landing/RouteLockSevenDayClient";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextSaturdayOnOrAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const offset = (6 - d.getUTCDay() + 7) % 7;
  return addDaysISO(iso, offset);
}

function validSaturday(iso: string | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 6;
}

export default async function DirectorRouteLockPageShell(props: {
  weekEnding?: string;
}) {
  noStore();

  const scope = await requireSelectedPcOrgServer();

  if (!scope.ok) {
    redirect("/home");
  }

  const sb = supabaseAdmin();
  const pc_org_id = scope.selected_pc_org_id;
  const today = todayInNY();
  const weekEnd = validSaturday(props.weekEnding)
    ? props.weekEnding
    : nextSaturdayOnOrAfter(today);
  const weekStart = addDaysISO(weekEnd, -6);

  const res = await getRouteLockDaysForRange(sb, pc_org_id, weekStart, weekEnd);
  const days = res.ok ? res.days : [];

  return (
    <PageShell>
      <DirectorWorkspaceSelector />

      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface)] p-3">
          <div className="mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Route Lock
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Schedule, quota, routes, shift validation, and check-in controls.
            </div>
          </div>

          <RouteLockSubnav />
        </div>

        <RouteLockSevenDayClient days={days} weekStart={weekStart} weekEnd={weekEnd} />
      </div>
    </PageShell>
  );
}
