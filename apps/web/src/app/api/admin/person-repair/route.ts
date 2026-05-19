import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/app/api/admin/catalogue/_lib/guards";
import {
  getPersonRepairPayload,
  mutatePersonRepair,
} from "@/features/admin/person-repair/server/personRepair.service";

export const runtime = "nodejs";

function readLimit(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("limit") ?? "250");
  return Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 1000) : 250;
}

export async function GET(req: NextRequest) {
  const { admin } = await requireAdmin();

  const result = await getPersonRepairPayload(admin, {
    q: req.nextUrl.searchParams.get("q") ?? "",
    limit: readLimit(req),
  });

  const { status, ...body } = result;
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  const { user, admin } = await requireAdmin();
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const result = await mutatePersonRepair(admin, user.id, {
    action: String((body as any).action ?? ""),
    person_id: (body as any).person_id ?? null,
    affiliation_id: (body as any).affiliation_id ?? null,
  });

  const { status, ...responseBody } = result;
  return NextResponse.json(responseBody, { status });
}
