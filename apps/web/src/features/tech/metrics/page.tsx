import Link from "next/link";
import { redirect } from "next/navigation";

import TechMetricsClient from "./components/TechMetricsClient";
import { getTechMetricsRangePayload } from "./lib/getTechMetricsRangePayload.server";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ range?: string }>;
};

function normalizeRange(raw: string | undefined): MetricsRangeKey {
  const next = String(raw ?? "FM").toUpperCase();
  if (next === "PREVIOUS" || next === "3FM" || next === "12FM") return next;
  return "FM";
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  const range = normalizeRange(searchParams?.range);
  const payload = await getTechMetricsRangePayload({ range });

  if (!payload.ok && payload.reason === "not_authenticated") {
    redirect("/login?next=/tech/metrics");
  }

  if (!payload.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24">
        <section className="rounded-2xl border bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tech Metrics
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Metrics unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your profile is active, but metrics could not be resolved for this technician assignment.
          </p>
          <Link href="/home" className="mt-4 inline-flex rounded-xl border px-3 py-2 text-sm font-medium">
            Back to home
          </Link>
        </section>
      </main>
    );
  }

  const header = payload.header;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24">
      <section className="rounded-2xl border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tech Metrics
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{header.full_name ?? "My Scorecard"}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {header.tech_id ? <span>Tech ID {header.tech_id}</span> : null}
          {header.pc_org_name ? <span>• {header.pc_org_name}</span> : null}
          {header.supervisor_name ? <span>• Supervisor: {header.supervisor_name}</span> : null}
          {header.affiliation ? <span>• {header.affiliation}</span> : null}
        </div>
      </section>

      <TechMetricsClient
        initialRange={payload.range}
        tiles={payload.tiles}
        ftrDebug={payload.ftrDebug as any}
        tnpsDebug={payload.tnpsDebug as any}
        toolUsageDebug={payload.toolUsageDebug as any}
        purePassDebug={payload.purePassDebug as any}
        callback48HrDebug={payload.callback48HrDebug as any}
        repeatDebug={payload.repeatDebug as any}
        soiDebug={payload.soiDebug as any}
        reworkDebug={payload.reworkDebug as any}
        metDebug={payload.metDebug as any}
      />
    </main>
  );
}
