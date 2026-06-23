import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireAccessPass } from "@/shared/access/requireAccessPass";

export const runtime = "nodejs";

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function sanitizeSearch(raw: string) {
  return raw.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(q: string) {
  return sanitizeSearch(q).toLowerCase().split(" ").filter(Boolean);
}

function overlapsToday(row: any) {
  const today = new Date().toISOString().slice(0, 10);
  const startOk = !row?.start_date || String(row.start_date) <= today;
  const endOk = !row?.end_date || String(row.end_date) >= today;
  return startOk && endOk;
}

function isCurrentWorkforceRow(row: any) {
  const status = String(row?.assignment_status ?? "").toLowerCase();
  const activeFlag = row?.is_active;
  return overlapsToday(row) && (status === "active" || activeFlag === true || !status);
}

function searchable(identity: any) {
  return [
    identity?.full_name,
    identity?.preferred_name,
    identity?.legal_name,
    identity?.tech_id,
    identity?.nt_login,
    identity?.csg,
    identity?.email,
  ]
    .map((v) => String(v ?? "").toLowerCase())
    .join(" ");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const pcOrgId = clean(url.searchParams.get("pc_org_id"));
  const q = sanitizeSearch(clean(url.searchParams.get("q")) ?? "");

  if (!pcOrgId) return json(400, { ok: false, error: "pc_org_id is required" });
  if (!q) return json(200, { ok: true, rows: [] });

  try {
    await requireAccessPass(req, pcOrgId);
  } catch (err: any) {
    return json(err?.status || 403, { ok: false, error: err?.message || "forbidden" });
  }

  const admin = supabaseAdmin();

  const { data: workforceRows, error: workforceErr } = await admin
    .from("workforce_current_v" as any)
    .select("person_id,pc_org_id,assignment_status,start_date,end_date,is_active")
    .eq("pc_org_id", pcOrgId)
    .limit(5000);

  if (workforceErr) return json(500, { ok: false, error: workforceErr.message });

  const personIds = Array.from(
    new Set(
      ((workforceRows ?? []) as any[])
        .filter(isCurrentWorkforceRow)
        .map((row) => clean(row?.person_id))
        .filter(Boolean) as string[],
    ),
  );

  if (!personIds.length) return json(200, { ok: true, rows: [] });

  const { data: identities, error: identityErr } = await admin
    .from("workforce_person_identity_v" as any)
    .select("person_id,full_name,legal_name,preferred_name,status,mobile,email,tech_id,nt_login,csg")
    .in("person_id", personIds)
    .limit(5000);

  if (identityErr) return json(500, { ok: false, error: identityErr.message });

  const qTokens = tokens(q);

  const rows = ((identities ?? []) as any[])
    .filter((identity) => qTokens.every((token) => searchable(identity).includes(token)))
    .map((identity) => ({
      person_id: clean(identity?.person_id),
      full_name: clean(identity?.full_name) ?? clean(identity?.preferred_name) ?? clean(identity?.legal_name),
      tech_id: clean(identity?.tech_id),
    }))
    .filter((row) => row.person_id && (row.full_name || row.tech_id))
    .sort((a, b) => String(a.full_name ?? "").localeCompare(String(b.full_name ?? "")))
    .slice(0, 25);

  return json(200, { ok: true, rows });
}
