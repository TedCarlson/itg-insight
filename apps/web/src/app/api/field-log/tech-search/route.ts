import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireAccessPass } from "@/shared/access/requireAccessPass";

export const runtime = "nodejs";

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function sanitizeSearch(raw: string) {
  return raw.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isActiveWindow(row: any, today: string) {
  const activeOk = row?.active === true || row?.active == null;
  const startOk = !row?.start_date || String(row.start_date) <= today;
  const endOk = !row?.end_date || String(row.end_date) >= today;
  return activeOk && startOk && endOk;
}

function pickBestAssignment(assignments: any[], today: string) {
  if (!assignments?.length) return null;

  const current = assignments.filter((a) => isActiveWindow(a, today) && a?.tech_id);
  const pool = current.length ? current : assignments.filter((a) => a?.tech_id);

  pool.sort((a, b) => String(b?.start_date ?? "").localeCompare(String(a?.start_date ?? "")));
  return pool[0] ?? null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const pcOrgId = String(url.searchParams.get("pc_org_id") ?? "").trim();
  const qRaw = String(url.searchParams.get("q") ?? "").trim();
  const q = sanitizeSearch(qRaw);

  if (!pcOrgId) {
    return json(400, { ok: false, error: "pc_org_id is required" });
  }

  if (!q) {
    return json(200, { ok: true, rows: [] });
  }

  try {
    await requireAccessPass(req, pcOrgId);
  } catch (err: any) {
    return json(err?.status || 403, { ok: false, error: err?.message || "forbidden" });
  }

  const admin = supabaseAdmin();
  const today = isoToday();

  const { data: assignments, error: asgErr } = await admin
    .from("assignment" as any)
    .select("person_id,tech_id,start_date,end_date,active,pc_org_id")
    .eq("pc_org_id", pcOrgId)
    .or(`tech_id.ilike.%${q}%`)
    .limit(100);

  if (asgErr) {
    return json(500, { ok: false, error: asgErr.message });
  }

  const asgRows = (assignments ?? []) as any[];
  const personIdsFromAsg = Array.from(
    new Set(
      asgRows
        .map((r) => String(r?.person_id ?? "").trim())
        .filter(Boolean),
    ),
  );

  const { data: peopleByName, error: peopleErr } = await admin
    .from("person" as any)
    .select("person_id,full_name")
    .ilike("full_name", `%${q}%`)
    .limit(100);

  if (peopleErr) {
    return json(500, { ok: false, error: peopleErr.message });
  }

  const nameRows = (peopleByName ?? []) as any[];
  const namePersonIds = nameRows
    .map((r) => String(r?.person_id ?? "").trim())
    .filter(Boolean);

  const candidateIds = Array.from(new Set([...personIdsFromAsg, ...namePersonIds]));
  if (!candidateIds.length) {
    return json(200, { ok: true, rows: [] });
  }

  const { data: allAssignments, error: allAsgErr } = await admin
    .from("assignment" as any)
    .select("person_id,tech_id,start_date,end_date,active,pc_org_id")
    .eq("pc_org_id", pcOrgId)
    .in("person_id", candidateIds)
    .limit(1000);

  if (allAsgErr) {
    return json(500, { ok: false, error: allAsgErr.message });
  }

  const { data: people, error: personErr } = await admin
    .from("person" as any)
    .select("person_id,full_name")
    .in("person_id", candidateIds)
    .limit(100);

  if (personErr) {
    return json(500, { ok: false, error: personErr.message });
  }

  const asgByPerson = new Map<string, any[]>();
  for (const a of (allAssignments ?? []) as any[]) {
    const pid = String(a?.person_id ?? "").trim();
    if (!pid) continue;
    const arr = asgByPerson.get(pid) ?? [];
    arr.push(a);
    asgByPerson.set(pid, arr);
  }

  const rows = ((people ?? []) as any[])
    .map((p) => {
      const personId = String(p?.person_id ?? "").trim();
      const best = pickBestAssignment(asgByPerson.get(personId) ?? [], today);

      return {
        person_id: personId,
        full_name: p?.full_name ? String(p.full_name) : null,
        tech_id: best?.tech_id ? String(best.tech_id).trim() : null,
      };
    })
    .filter((r) => r.full_name || r.tech_id)
    .filter((r) => {
      const hay = `${r.full_name ?? ""} ${r.tech_id ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    })
    .sort((a, b) => String(a.full_name ?? "").localeCompare(String(b.full_name ?? "")))
    .slice(0, 25);

  return json(200, { ok: true, rows });
}