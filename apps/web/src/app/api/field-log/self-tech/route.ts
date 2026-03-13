import { NextRequest, NextResponse } from "next/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function json(status: number, payload: unknown) {
  return NextResponse.json(payload, { status });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const pcOrgId = String(url.searchParams.get("pc_org_id") ?? "").trim();

  if (!pcOrgId) {
    return json(400, { ok: false, error: "pc_org_id is required" });
  }

  let pass;
  try {
    pass = await requireAccessPass(req, pcOrgId);
  } catch (err: any) {
    return json(err?.status || 403, { ok: false, error: err?.message || "forbidden" });
  }

  if (!pass.person_id) {
    return json(200, {
      ok: true,
      isTechUploader: false,
      personId: null,
      techId: null,
    });
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("assignment" as any)
    .select("person_id,tech_id,active,start_date,end_date")
    .eq("pc_org_id", pcOrgId)
    .eq("person_id", pass.person_id)
    .order("start_date", { ascending: false })
    .limit(10);

  if (error) {
    return json(500, { ok: false, error: error.message });
  }

  const today = new Date().toISOString().slice(0, 10);

  const rows = (data ?? []) as Array<{
    person_id: string | null;
    tech_id: string | null;
    active: boolean | null;
    start_date: string | null;
    end_date: string | null;
  }>;

  const activeRow =
    rows.find((row) => {
      const activeOk = row.active === true || row.active == null;
      const startOk = !row.start_date || row.start_date <= today;
      const endOk = !row.end_date || row.end_date >= today;
      return activeOk && startOk && endOk && !!row.tech_id;
    }) ??
    rows.find((row) => !!row.tech_id) ??
    null;

  return json(200, {
    ok: true,
    isTechUploader: !!activeRow?.tech_id,
    personId: pass.person_id,
    techId: activeRow?.tech_id ?? null,
  });
}