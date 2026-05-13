// path: apps/web/src/shared/server/executive/buildOperationalReadiness.server.ts

import type {
  MarketOperationalComparisonRow,
} from "@/shared/server/executive/buildMarketOperationalComparison.server";

export type OperationalReadiness = {
  total_active_hc: number;

  total_scheduled_hc: number;
  total_unscheduled_hc: number;

  training_hc: number;
  travel_hc: number;

  utilization_rate: number;

  markets_under_pressure: number;

  readiness_status:
    | "HEALTHY"
    | "WATCH"
    | "UNDER_PRESSURE";
};

type BuildOperationalReadinessArgs = {
  marketRows: MarketOperationalComparisonRow[];
};

function deriveReadinessStatus(args: {
  utilizationRate: number;
  marketsUnderPressure: number;
  totalMarkets: number;
}) {
  const {
    utilizationRate,
    marketsUnderPressure,
    totalMarkets,
  } = args;

  const pressureRate =
    totalMarkets > 0
      ? marketsUnderPressure /
        totalMarkets
      : 0;

  if (
    utilizationRate < 0.82 ||
    pressureRate >= 0.4
  ) {
    return "UNDER_PRESSURE" as const;
  }

  if (
    utilizationRate < 0.9 ||
    pressureRate >= 0.2
  ) {
    return "WATCH" as const;
  }

  return "HEALTHY" as const;
}

export function buildOperationalReadiness({
  marketRows,
}: BuildOperationalReadinessArgs): OperationalReadiness {
  let total_active_hc = 0;

  let total_scheduled_hc = 0;
  let total_unscheduled_hc = 0;

  let training_hc = 0;
  let travel_hc = 0;

  let markets_under_pressure = 0;

  for (const row of marketRows) {
    total_active_hc += row.active_hc;

    total_scheduled_hc +=
      row.scheduled_hc;

    total_unscheduled_hc +=
      row.unscheduled_hc;

    training_hc += row.training_hc;

    travel_hc += row.travel_hc;

    if (
      row.status ===
      "UNDER_PRESSURE"
    ) {
      markets_under_pressure += 1;
    }
  }

  const utilization_rate =
    total_active_hc > 0
      ? total_scheduled_hc /
        total_active_hc
      : 0;

  return {
    total_active_hc,

    total_scheduled_hc,
    total_unscheduled_hc,

    training_hc,
    travel_hc,

    utilization_rate,

    markets_under_pressure,

    readiness_status:
      deriveReadinessStatus({
        utilizationRate:
          utilization_rate,

        marketsUnderPressure:
          markets_under_pressure,

        totalMarkets:
          marketRows.length,
      }),
  };
}

export default buildOperationalReadiness;