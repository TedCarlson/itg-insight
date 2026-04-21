import { NextRequest, NextResponse } from "next/server";

import { getWorkforceMetricInspectionPayload } from "@/shared/kpis/engine/getWorkforceMetricInspectionPayload.server";
import type { KpiBandKey, MetricsRangeKey } from "@/shared/kpis/core/types";

function isMetricsRangeKey(value: string | null): value is MetricsRangeKey {
  return value === "FM" || value === "PREVIOUS" || value === "3FM" || value === "12FM";
}

function isKpiBandKey(value: string | null): value is KpiBandKey {
  return (
    value === "EXCEEDS" ||
    value === "MEETS" ||
    value === "NEEDS_IMPROVEMENT" ||
    value === "MISSES" ||
    value === "NO_DATA"
  );
}

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const person_id = searchParams.get("person_id");
    const tech_id = searchParams.get("tech_id");
    const full_name = searchParams.get("full_name") ?? "Unknown Tech";
    const context = searchParams.get("context") ?? "Unknown Context";
    const contractor_name = searchParams.get("contractor_name");

    const kpi_key = searchParams.get("kpi_key");
    const title = searchParams.get("title");
    const value_display = searchParams.get("value_display");
    const value = parseNumber(searchParams.get("value"));

    const band_key_raw = searchParams.get("band_key");
    const range_raw = searchParams.get("range");
    const class_type = searchParams.get("class_type");

    if (!person_id || !tech_id || !kpi_key) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required query params: person_id, tech_id, kpi_key",
        },
        { status: 400 }
      );
    }

    const active_range: MetricsRangeKey = isMetricsRangeKey(range_raw) ? range_raw : "FM";
    const band_key: KpiBandKey = isKpiBandKey(band_key_raw) ? band_key_raw : "NO_DATA";

    const payload = await getWorkforceMetricInspectionPayload({
      surface: "role_company_supervisor",
      active_range,
      kpi_key,
      target: {
        person_id,
        tech_id,
        full_name,
        context,
        contractor_name,
      },
      title,
      value,
      value_display,
      band_key,
      summary_rows: [],
      trend_points: [],
      period_detail: null,
      fact_rows: contractor_name
        ? [{ label: "Contractor", value: contractor_name }]
        : [],
      payload: null,
    });

    console.log("inspection payload deep debug", {
      kpi_key,
      active_range,
      class_type,
      has_payload: !!payload,
      has_render_model: !!payload?.render_model,
      metric_family: payload?.metric_family ?? null,
      has_source_payload: !!(payload as any)?.payload,
      source_payload_keys:
        (payload as any)?.payload && typeof (payload as any).payload === "object"
          ? Object.keys((payload as any).payload)
          : null,
    });

    return NextResponse.json({
      ok: true,
      payload,
    });
  } catch (error) {
    console.error("GET /api/metrics/inspection failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to build inspection payload",
      },
      { status: 500 }
    );
  }
}