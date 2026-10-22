// path: apps/web/src/app/api/reports/exhibit/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { loadExhibitFiscalMonth } from "@/shared/server/reports/loadExhibitFiscalMonth.server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const scope = await requireSelectedPcOrgServer();

  if (!scope.ok) {
    return NextResponse.json(
      { error: scope.reason },
      { status: scope.reason === "not_authenticated" ? 401 : 400 }
    );
  }

  try {
    await requireAccessPass(req, scope.selected_pc_org_id);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const fiscalMonthId = req.nextUrl.searchParams.get("fiscal_month_id");

  try {
    const payload = await loadExhibitFiscalMonth({
      pc_org_id: scope.selected_pc_org_id,
      fiscal_month_id: fiscalMonthId,
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load exhibit";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
