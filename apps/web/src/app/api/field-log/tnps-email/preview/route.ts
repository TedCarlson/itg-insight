import { NextRequest, NextResponse } from "next/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { buildTnpsDigest } from "@/features/field-log/server/buildTnpsDigest.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pcOrgId = String(body?.pcOrgId ?? "").trim();
    const reportIds = Array.isArray(body?.reportIds) ? body.reportIds.map(String) : [];
    if (!pcOrgId) return NextResponse.json({ ok: false, error: "pcOrgId is required." }, { status: 400 });
    await requireAccessPass(req, pcOrgId);
    const digest = await buildTnpsDigest({ pcOrgId, reportIds });
    return NextResponse.json({ ok: true, data: digest });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to build tNPS email." }, { status: 500 });
  }
}
