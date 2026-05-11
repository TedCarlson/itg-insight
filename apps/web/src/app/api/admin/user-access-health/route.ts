// path: apps/web/src/app/api/admin/user-access-health/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireAccessHealthAdmin } from "@/features/admin/access-health/lib/accessHealthGuard";
import { buildHealthRow } from "@/features/admin/access-health/lib/buildHealthRow";
import { clean } from "@/features/admin/access-health/lib/accessHealthUtils";

export async function GET(req: NextRequest) {
  const guard = await requireAccessHealthAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const q = clean(req.nextUrl.searchParams.get("q"))?.toLowerCase() ?? null;
  const authUserId = clean(req.nextUrl.searchParams.get("auth_user_id"));
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 25;

  const admin = supabaseAdmin();

  const usersRes = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const users = usersRes.data.users ?? [];

  const filtered = users
    .filter((user) => {
      if (authUserId) return user.id === authUserId;
      if (!q) return true;

      return (
        String(user.email ?? "").toLowerCase().includes(q) ||
        String(user.id ?? "").toLowerCase().includes(q)
      );
    })
    .slice(0, limit);

  const rows = await Promise.all(
    filtered.map((user) =>
      buildHealthRow({
        auth_user_id: user.id,
        email: user.email ?? null,
        last_sign_in_at: (user.last_sign_in_at as string | null) ?? null,
      })
    )
  );

  return NextResponse.json(
    {
      ok: true,
      count: rows.length,
      rows,
    },
    { status: 200 }
  );
}