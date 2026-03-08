import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import { getRouteLockDaysForFiscalMonth } from "@/features/route-lock/calendar/lib/getRouteLockDays.server";

import { RouteLockCalendarClient } from "@/features/route-lock/calendar/RouteLockCalendarClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = { month?: string };
type Props = { searchParams?: Promise<SearchParams> };

type FiscalMonth = { fiscal_month_id: string; start_date: string; end_date: string; label: string | null };

async function resolveCurrentFiscalMonth(sb: any, anchorISO: string): Promise<FiscalMonth | null> {
  const { data } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lte("start_date", anchorISO)
    .gte("end_date", anchorISO)
    .maybeSingle();

  if (!data?.fiscal_month_id) return null;

  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date),
    end_date: String(data.end_date),
    label: (data.label as string | null) ?? null,
  };
}

async function resolvePrevFiscalMonth(sb: any, currentStartISO: string): Promise<FiscalMonth | null> {
  const { data } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lt("end_date", currentStartISO)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.fiscal_month_id) return null;

  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date),
    end_date: String(data.end_date),
    label: (data.label as string | null) ?? null,
  };
}

async function resolveNextFiscalMonth(sb: any, currentEndISO: string): Promise<FiscalMonth | null> {
  const { data } = await sb
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .gt("start_date", currentEndISO)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.fiscal_month_id) return null;

  return {
    fiscal_month_id: String(data.fiscal_month_id),
    start_date: String(data.start_date),
    end_date: String(data.end_date),
    label: (data.label as string | null) ?? null,
  };
}

export default async function RouteLockCalendarPage({ searchParams }: Props) {
  noStore();

  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) redirect("/home");

  const sb = supabaseAdmin();
  const pc_org_id = scope.selected_pc_org_id;

  const today = todayInNY();

  const fmCurrent = await resolveCurrentFiscalMonth(sb, today);
  if (!fmCurrent) {
    return (
      <PageShell>
        <Card>
          <div className="text-sm text-[var(--to-warning)]">Could not resolve fiscal month.</div>
        </Card>
      </PageShell>
    );
  }

  const fmPrev = await resolvePrevFiscalMonth(sb, fmCurrent.start_date);
  const fmNext = await resolveNextFiscalMonth(sb, fmCurrent.end_date);

  const sp = (await searchParams) ?? {};
  const rawMode = String(sp.month ?? "current");

  const monthMode: "prev" | "current" | "next" =
    rawMode === "prev" ? "prev" : rawMode === "next" ? "next" : "current";

  const activeFm = monthMode === "prev" ? fmPrev : monthMode === "next" ? fmNext : fmCurrent;

  if (!activeFm) {
    return (
      <PageShell>
        <Card>
          <div className="text-sm text-[var(--to-warning)]">Could not resolve fiscal month.</div>
        </Card>
      </PageShell>
    );
  }

  const prevHref = "/route-lock/calendar?month=prev";
  const currentHref = "/route-lock/calendar?month=current";
  const nextHref = "/route-lock/calendar?month=next";

  const showPrev = monthMode !== "prev";
  const showCurrent = monthMode !== "current";
  const showNext = monthMode !== "next";

  const res = await getRouteLockDaysForFiscalMonth(sb, pc_org_id, activeFm.fiscal_month_id);

  if (!res.ok) {
    return (
      <PageShell>
        <Card>
          <div className="text-sm text-[var(--to-warning)]">{String(res.error)}</div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <RouteLockCalendarClient
        fiscal={res.fiscal}
        days={res.days}
        todayIso={today}
        prevHref={showPrev ? prevHref : null}
        currentHref={showCurrent ? currentHref : null}
        nextHref={showNext ? nextHref : null}
      />
    </PageShell>
  );
}