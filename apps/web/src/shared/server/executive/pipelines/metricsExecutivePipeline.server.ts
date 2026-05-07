import { buildMetricsSurfacePayload } from "@/shared/server/metrics/buildMetricsSurfacePayload.server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import type { ExecutiveDimensionPayload } from "@/shared/types/executive/executiveSuite";
import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";

const DIRECTOR_EXECUTIVE_HREF = "/director/executive";

export async function buildMetricsExecutiveDimension(args: {
  pc_org_id: string;
  as_of_date: string;
  range: MetricsRangeKey;
}): Promise<ExecutiveDimensionPayload> {
  const workforceRows = await loadWorkforceSourceRows({
    pc_org_id: args.pc_org_id,
    as_of_date: args.as_of_date,
  });

  const scopedTechIds = workforceRows
    .filter((row) => row.is_active && (row.is_field || row.is_travel_tech))
    .map((row) => String(row.tech_id ?? "").trim())
    .filter(Boolean);

  if (!scopedTechIds.length) {
    return {
      dimension: "metrics",
      title: "Metrics",
      status: "empty",
      artifacts: [
        {
          key: "kpi_summary",
          title: "KPI Summary",
          description: "No eligible field contributors were found for metrics scoping.",
          status: "empty",
          href: DIRECTOR_EXECUTIVE_HREF,
          cards: [],
        },
      ],
    };
  }

  const payload = await buildMetricsSurfacePayload({
    role_key: "DIRECTOR_EXECUTIVE",
    profile_key: "NSR",
    pc_org_id: args.pc_org_id,
    range: args.range,
    scoped_tech_ids: scopedTechIds,
    role_label: "Director",
    rep_full_name: null,
    visibility: {
      show_jobs: true,
      show_risk: true,
      show_work_mix: false,
      show_parity: false,
    },
  });

  const baseItems = payload.executive_strip?.base?.items ?? [];
  const riskTop = payload.risk_insights?.top_priority_kpi ?? null;

  return {
    dimension: "metrics",
    title: "Metrics",
    status: "ready",
    artifacts: [
      {
        key: "kpi_summary",
        title: "KPI Summary",
        description: "Current executive KPI strip scoped to all eligible contributors.",
        status: baseItems.length ? "ready" : "empty",
        href: DIRECTOR_EXECUTIVE_HREF,
        cards: baseItems.slice(0, 4).map((item) => ({
          key: item.kpi_key,
          label: item.label,
          value: item.value_display,
          helper: item.support ?? item.band_label ?? null,
          status: "ready",
        })),
      },
      {
        key: "risk_focus",
        title: "Risk Focus",
        description: "Highest visible metrics pressure point for leadership follow-up.",
        status: riskTop?.kpi_key ? "ready" : "empty",
        href: DIRECTOR_EXECUTIVE_HREF,
        cards: riskTop?.kpi_key
          ? [
              {
                key: "priority",
                label: riskTop.label ?? "Top Priority",
                value: String(riskTop.miss_count),
                helper: "miss / pressure count",
              },
              {
                key: "impacted",
                label: "Impacted Techs",
                value: String(riskTop.tech_ids?.length ?? 0),
              },
            ]
          : [],
      },
    ],
  };
}