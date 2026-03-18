import { headers } from "next/headers";

import TechSurfaceHeader from "@/features/tech/shared/components/TechSurfaceHeader";
import { getTechWhoAmI } from "@/features/tech/shared/lib/getTechWhoAmI";
import TechMetricsClient from "@/features/tech/metrics/components/TechMetricsClient";
import { getTechShellContext } from "@/features/tech/lib/getTechShellContext";
import {
  getTechMetricsRangePayload,
  type MetricsRangeKey,
} from "@/features/tech/metrics/lib/getTechMetricsRangePayload.server";
import { getMetricFtrPayload } from "@/features/tech/metrics/lib/getMetricFtrPayload.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getActivePresetKey(): Promise<string | null> {
  try {
    const h = await headers();
    const protocol = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return null;

    const res = await fetch(`${protocol}://${host}/api/admin/metrics-colors`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json = await res.json().catch(() => null);
    return json?.activePresetKey ?? null;
  } catch {
    return null;
  }
}

function formatPct(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value.toFixed(1)}%`;
}

export default async function TechMetricsFeaturePage(props: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const [who, shell] = await Promise.all([
    getTechWhoAmI(),
    getTechShellContext(),
  ]);

  const sp = (await props.searchParams) ?? {};
  const rawRange = String(sp.range ?? "FM").toUpperCase();
  const range: MetricsRangeKey =
    rawRange === "3FM" ? "3FM" : rawRange === "12FM" ? "12FM" : "FM";

  const [payload, activePresetKey, ftrPayload] =
    shell.ok && shell.person_id && who.tech_id
      ? await Promise.all([
          getTechMetricsRangePayload({
            person_id: shell.person_id,
            range,
          }),
          getActivePresetKey(),
          getMetricFtrPayload({
            person_id: shell.person_id,
            tech_id: who.tech_id,
            range,
          }),
        ])
      : [null, null, null];

  const tiles =
    payload?.tiles?.map((tile) => {
      if (tile.kpi_key !== "ftr_rate") return tile;

      const ftrValue = ftrPayload?.summary?.ftr_rate ?? null;
      const ftrJobs = ftrPayload?.summary?.total_contact_jobs ?? null;
      const failJobs = ftrPayload?.summary?.total_fail_jobs ?? null;

      return {
        ...tile,
        value: ftrValue,
        value_display: formatPct(ftrValue),
        context: {
          sample_short: ftrJobs,
          sample_long: failJobs,
          meets_min_volume: null,
        },
      };
    }) ?? [];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-4">
        <TechSurfaceHeader
          title="Metrics"
          fullName={who.full_name}
          techId={who.tech_id}
          affiliation={who.affiliation}
        />
      </section>

      <TechMetricsClient
        initialRange={range}
        tiles={tiles}
        activePresetKey={activePresetKey}
        ftrDebug={ftrPayload?.debug ?? null}
      />
    </div>
  );
}