// path: apps/web/src/features/role-bp-owner/pages/BpOwnerOverviewPageShell.tsx

import { unstable_noStore as noStore } from "next/cache";

import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import MetricsExecutiveKpiMatrix from "@/shared/surfaces/MetricsExecutiveKpiMatrix";

import type { MetricsExecutiveKpiItem } from "@/shared/types/metrics/executiveStrip";

import BpOwnerRouteDemandCard from "../components/BpOwnerRouteDemandCard";
import getBpOwnerOverviewPayload from "../lib/getBpOwnerOverviewPayload.server";
import getBpOwnerSurfacePayload from "../lib/getBpOwnerSurfacePayload.server";

type BpOwnerOrgKpiRow = {
  pc_org_id?: string | null;
  org_label: string;
  items: MetricsExecutiveKpiItem[];
};

function StatusPill(props: {
  tone: "ready" | "watch" | "degraded";
  label: string;
}) {
  const toneClass =
    props.tone === "ready"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : props.tone === "watch"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        toneClass,
      ].join(" ")}
    >
      {props.label}
    </span>
  );
}

function getBpOwnerOrgKpiRows(payload: unknown): BpOwnerOrgKpiRow[] {
  const raw = (payload as { bp_owner_org_kpi_rows?: unknown })
    .bp_owner_org_kpi_rows;

  if (!Array.isArray(raw)) return [];

  return raw
    .map((row) => {
      const item = row as Partial<BpOwnerOrgKpiRow>;

      return {
        pc_org_id: item.pc_org_id ?? null,
        org_label: String(item.org_label ?? "").trim(),
        items: Array.isArray(item.items) ? item.items : [],
      };
    })
    .filter((row) => row.org_label);
}

export default async function BpOwnerOverviewPageShell() {
  noStore();

  const [payload, metricsPayload] = await Promise.all([
    getBpOwnerOverviewPayload(),
    getBpOwnerSurfacePayload({
      profile_key: "NSR",
      range: "FM",
    }),
  ]);

  const contractorName = payload.contractor_name ?? "Business Partner";

  const totalTechs = payload.role_breakout_by_org.reduce(
    (sum, row) => sum + row.tech_count,
    0,
  );

  const totalLeadership = payload.role_breakout_by_org.reduce(
    (sum, row) => sum + row.bp_owner_count + row.bp_supervisor_count,
    0,
  );

  const metricMatrixRows = [
    {
      label: `${contractorName} Total`,
      subtitle: "Recomputed contractor aggregate across covered orgs.",
      items: metricsPayload.executive_strip?.base?.items ?? [],
    },
    ...getBpOwnerOrgKpiRows(metricsPayload).map((row) => ({
      label: `${contractorName} • ${row.org_label}`,
      subtitle: "Contractor performance inside this region.",
      items: row.items,
    })),
  ];

  return (
    <PageShell>
      <PageHeader
        title={`${contractorName} Workspace`}
        subtitle="Contractor-scoped operating view across workforce, people, metrics, and operational visibility."
      />

      <div
        id="shell-role-hint"
        data-shell-role="BP_OWNER"
        className="hidden"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Workforce</div>
              <div className="text-sm text-muted-foreground">
                Contractor staffing composition
              </div>
            </div>

            <StatusPill tone="ready" label="ready" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Group</th>
                  <th className="px-4 py-3 text-right font-semibold">HC</th>
                  <th className="px-4 py-3 text-right font-semibold">Techs</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Leadership
                  </th>
                </tr>
              </thead>

              <tbody>
                {payload.role_breakout_by_org.length ? (
                  payload.role_breakout_by_org.map((row) => (
                    <tr key={row.pc_org_id} className="border-t">
                      <td className="px-4 py-3 font-medium">
                        {row.org_label}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.active_people}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.tech_count}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.bp_owner_count + row.bp_supervisor_count}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No contractor workforce rows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border px-3 py-2.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Workforce
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {payload.workforce_count}
              </div>
            </div>

            <div className="rounded-lg border px-3 py-2.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Techs
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {totalTechs}
              </div>
            </div>

            <div className="rounded-lg border px-3 py-2.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Leaders
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {totalLeadership}
              </div>
            </div>
          </div>
        </Card>

        <BpOwnerRouteDemandCard status={payload.daily_schedule_status} />

        <div className="min-w-0 lg:col-span-2">
          <MetricsExecutiveKpiMatrix
            title={`${contractorName} Metrics`}
            subtitle="Configured executive KPIs across contractor total and covered regions."
            rows={metricMatrixRows}
            runtime={metricsPayload.executive_strip?.runtime ?? null}
          />
        </div>
      </div>
    </PageShell>
  );
}