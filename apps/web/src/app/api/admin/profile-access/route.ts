import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/app/api/admin/catalogue/_lib/guards";
import {
  getProfileAccessPayload,
  mutateProfileAccess,
} from "@/features/admin/profile-access/server/profileAccess.service";
import type { ProfileAccessAction } from "@/features/admin/profile-access/server/profileAccess.types";

export const runtime = "nodejs";

function readLimit(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("limit") ?? "250");
  return Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 1000) : 250;
}

export async function GET(req: NextRequest) {
  const { admin } = await requireAdmin();

  const result = await getProfileAccessPayload(admin, {
    q: (req.nextUrl.searchParams.get("q") ?? "").trim(),
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

  const result = await mutateProfileAccess(admin, user.id, {
    action: String((body as any).action ?? "") as ProfileAccessAction,
    auth_user_id: String((body as any).auth_user_id ?? ""),
    pc_org_id:
      (body as any).pc_org_id === undefined || (body as any).pc_org_id === ""
        ? null
        : String((body as any).pc_org_id),
    permission_key:
      (body as any).permission_key === undefined || (body as any).permission_key === ""
        ? null
        : String((body as any).permission_key),
    enabled: (body as any).enabled === true,
  });

  const { status, ...responseBody } = result;
  return NextResponse.json(responseBody, { status });
}
