// path: apps/web/src/features/role-director/pages/DirectorRouteLockPageShell.tsx

import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PageShell } from "@/components/ui/PageShell";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { DirectorWorkspaceSelector } from "@/shared/surfaces/navigation/DirectorWorkspaceSelector";

import RouteLockSubnav from "@/features/route-lock/components/RouteLockSubnav";
import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import { getRouteLockDaysForCurrentFiscalMonth } from "@/features/route-lock/calendar/lib/getRouteLockDays.server";
import { RouteLockSevenDayClient } from "@/features/route-lock/landing/RouteLockSevenDayClient";

export default async function DirectorRouteLockPageShell() {
  noStore();

  const scope = await requireSelectedPcOrgServer();

  if (!scope.ok) {
    redirect("/home");
  }

  const sb = supabaseAdmin();
  const pc_org_id = scope.selected_pc_org_id;

  const res = await getRouteLockDaysForCurrentFiscalMonth(sb, pc_org_id);

  const today = todayInNY();

  const next7 = res.ok
    ? res.days.filter((d) => d.date >= today).slice(0, 7)
    : [];

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

        <RouteLockSevenDayClient days={next7} />
      </div>
    </PageShell>
  );
}