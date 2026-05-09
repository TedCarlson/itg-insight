// path: apps/web/src/features/role-bp-owner/pages/BpOwnerOverviewPageShell.tsx

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import getBpOwnerOverviewPayload from "../lib/getBpOwnerOverviewPayload.server";

function StatCard(props: {
  label: string;
  value: string | number;
  helper: string;
  href?: string;
}) {
  const body = (
    <Card className="h-full p-5 transition hover:border-foreground/20 hover:bg-muted/20">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums">{props.value}</div>
      <p className="mt-2 text-sm text-muted-foreground">{props.helper}</p>
    </Card>
  );

  if (!props.href) return body;

  return (
    <Link href={props.href} prefetch={false} className="block h-full">
      {body}
    </Link>
  );
}

export default async function BpOwnerOverviewPageShell() {
  noStore();

  const payload = await getBpOwnerOverviewPayload();
  const contractorName = payload.contractor_name ?? "Business Partner";

  return (
    <PageShell>
      <PageHeader
        title={`${contractorName} Workspace`}
        subtitle="Contractor-scoped operating view across workforce, people, metrics, and read-only schedule reporting."
      />

      <div id="shell-role-hint" data-shell-role="BP_OWNER" className="hidden" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Workforce"
          value={payload.workforce_count}
          helper="Direct affiliate assignment rows across active covered orgs."
          href="/bp-owner/workforce"
        />

        <StatCard
          label="Org Coverage"
          value={payload.active_org_count}
          helper="Active orgs where this contractor has app coverage."
        />

        <StatCard
          label="People"
          value="Scoped"
          helper="People records tied to the contractor affiliation."
          href="/bp-owner/people"
        />

        <StatCard
          label="Metrics"
          value="Company scoped"
          helper="Performance visibility limited to direct affiliates."
          href="/bp-owner/metrics"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Active Roles by Org</div>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Contractor workforce composition across active org coverage. This
                view is not limited by the selected org; selected org remains app
                context, while BP Owner overview reads the contractor universe.
              </p>
            </div>

            <Link
              href="/bp-owner/workforce"
              prefetch={false}
              className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Open Workforce
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Org</th>
                  <th className="px-4 py-3 text-right font-semibold">Active</th>
                  <th className="px-4 py-3 text-right font-semibold">Owners</th>
                  <th className="px-4 py-3 text-right font-semibold">Supv/Lead</th>
                  <th className="px-4 py-3 text-right font-semibold">Techs</th>
                  <th className="px-4 py-3 text-right font-semibold">Other</th>
                </tr>
              </thead>
              <tbody>
                {payload.role_breakout_by_org.length ? (
                  payload.role_breakout_by_org.map((row) => (
                    <tr key={row.pc_org_id} className="border-t">
                      <td className="px-4 py-3 font-medium">{row.org_label}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.active_people}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.bp_owner_count}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.bp_supervisor_count}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.tech_count}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.other_count}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No active contractor workforce rows found for this BP Owner scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold">BP Owner Universe</div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border bg-background/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Visibility
              </div>
              <div className="mt-1 font-medium">Direct affiliates only</div>
            </div>

            <div className="rounded-xl border bg-background/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Schedule
              </div>
              <div className="mt-1 font-medium">
                Report-only inside Workforce
              </div>
            </div>

            <div className="rounded-xl border bg-background/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Metrics
              </div>
              <div className="mt-1 font-medium">
                {payload.metrics.scoped ? "Company scoped" : "Not scoped"}
              </div>
            </div>

            <div className="rounded-xl border bg-background/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Operating Focus
              </div>
              <div className="mt-1 font-medium">
                Staffing, people readiness, and affiliate performance.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}