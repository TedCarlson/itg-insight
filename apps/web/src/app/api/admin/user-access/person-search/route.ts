import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireAdmin } from "@/app/api/admin/catalogue/_lib/guards";

type Row = {
  person_id: string;
  full_name: string;
  emails: string | null;
  active: boolean;
};

export async function GET(req: NextRequest) {
  await requireAdmin();

  const qRaw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const q = qRaw.toLowerCase();

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

  if (!q) {
    return NextResponse.json({ ok: true, rows: [] satisfies Row[] }, { status: 200 });
  }

  const admin = supabaseAdmin();

  // Search people by full_name or emails (your DB already has trigram indexes for these)
  const res = await admin
    .from("person")
    .select("person_id,full_name,emails,active")
    .or(`full_name.ilike.%${q}%,emails.ilike.%${q}%`)
    .order("active", { ascending: false })
    .order("full_name", { ascending: true })
    .limit(limit);

  if (res.error) {
    return NextResponse.json({ ok: false, error: "person_search_failed", details: res.error }, { status: 500 });
  }

  const rows: Row[] = (res.data ?? []).map((r: any) => ({
    person_id: String(r.person_id),
    full_name: String(r.full_name),
    emails: r.emails ?? null,
    active: !!r.active,
  }));

  return NextResponse.json({ ok: true, rows }, { status: 200 });
}