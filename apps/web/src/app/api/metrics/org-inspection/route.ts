// path: apps/web/src/app/api/metrics/org-inspection/route.ts

import { NextRequest, NextResponse } from "next/server";

import { getOrgMetricPayload } from "@/shared/kpis/engine/payloads/getOrgMetricPayload.server";
import type { MetricsRangeKey } from "@/shared/kpis/core/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeRange(value: string | null): MetricsRangeKey {
  if (value === "PREVIOUS") return "PREVIOUS";
  if (value === "3FM") return "3FM";
  if (value === "12FM") return "12FM";
  return "FM";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const kpiKey = String(url.searchParams.get("kpi_key") ?? "").trim();
    const range = normalizeRange(url.searchParams.get("range"));

    if (!kpiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing kpi_key" },
        { status: 400 }
      );
    }

    const payload = await getOrgMetricPayload({
      kpi_key: kpiKey,
      range,
      summary_type: "pc_org_total",
    });

    return NextResponse.json({
      ok: true,
      data: payload,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Unable to load org inspection payload",
      },
      { status: 500 }
    );
  }
}