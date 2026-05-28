// path: apps/web/src/app/api/route-lock/ota/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveOtaReportAccess } from "@/shared/server/route-lock/ota/otaReportAccess.server";
import { parseOtaReportSearchParams } from "@/shared/server/route-lock/ota/otaReport.schema.server";
import { getOtaReportAction } from "@/shared/server/route-lock/ota/otaReportService.server";

export const runtime = "nodejs";

function errorPayload(error: unknown) {
  const e = error as any;

  return {
    ok: false,
    error: String(e?.message ?? "server_error"),
    hint: e?.hint ?? undefined,
    detail: e?.detail ?? undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const params = parseOtaReportSearchParams(req.nextUrl.searchParams);
    const access = await resolveOtaReportAccess(req);

    const result = await getOtaReportAction({
      admin: supabaseAdmin(),
      pcOrgId: access.pcOrgId,
      params,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(errorPayload(error), {
      status: Number(error?.status ?? 500),
    });
  }
}
