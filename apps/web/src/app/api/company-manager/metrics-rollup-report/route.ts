// path: apps/web/src/app/api/company-manager/metrics-rollup-report/route.ts

import { NextRequest, NextResponse } from "next/server";

import { getCompanyManagerSurfacePayload } from "@/features/role-company-manager/lib/getCompanyManagerSurfacePayload.server";
import { buildCompanyManagerRollupReportPayload } from "@/features/role-company-manager/server/buildCompanyManagerRollupReportPayload.server";

function normalizeClassType(value: string | null): "NSR" | "SMART" {
  return value === "SMART" ? "SMART" : "NSR";
}

function normalizeRange(value: string | null): "FM" | "PREVIOUS" | "3FM" | "12FM" {
  if (value === "PREVIOUS") return "PREVIOUS";
  if (value === "3FM") return "3FM";
  if (value === "12FM") return "12FM";
  return "FM";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const classType = normalizeClassType(url.searchParams.get("class_type"));
    const range = normalizeRange(url.searchParams.get("range"));

    // 1. reuse existing manager payload (already workforce-correct)
    const surfacePayload = await getCompanyManagerSurfacePayload({
      profile_key: classType,
      range,
    });

    // 2. build report payload (heavy logic here, not in UI)
    const reportPayload = buildCompanyManagerRollupReportPayload({
      payload: surfacePayload,
      class_type: classType,
      range,
    });

    return NextResponse.json({
      ok: true,
      data: reportPayload,
    });
  } catch (err: any) {
    console.error("metrics-rollup-report error", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Failed to build rollup report",
      },
      { status: 500 }
    );
  }
}