import { NextResponse } from "next/server";

import { getHomePayload } from "@/features/home/lib/getHomePayload.server";
import { getFeedWidgetPayload } from "@/features/home/lib/getWidgetPayload.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [home, scope] = await Promise.all([
      getHomePayload(),
      requireSelectedPcOrgServer(),
    ]);

    const selectedPcOrgId = scope.ok ? scope.selected_pc_org_id : null;

    const items = await getFeedWidgetPayload({
      role: home.role,
      selectedPcOrgId,
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}