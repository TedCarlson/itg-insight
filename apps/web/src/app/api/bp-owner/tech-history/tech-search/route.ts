// path: apps/web/src/app/api/bp-owner/tech-history/tech-search/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveBpOwnerScope } from "@/features/role-bp-owner/lib/resolveBpOwnerScope.server";

export const runtime = "nodejs";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function escLike(input: string) {
  return input.replace(/[%_,]/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const qRaw = clean(req.nextUrl.searchParams.get("q"));
    const q = escLike(qRaw);

    const limit = Math.max(
      1,
      Math.min(20, Number(req.nextUrl.searchParams.get("limit") ?? 10) || 10),
    );

    const scope = await resolveBpOwnerScope();

    const coveredOrgIds = scope.covered_pc_org_ids.map(clean).filter(Boolean);

    const affiliateAssignmentIds = new Set(
      scope.scoped_assignments
        .map((row) => clean(row.assignment_id))
        .filter(Boolean),
    );

    if (!coveredOrgIds.length || !affiliateAssignmentIds.size) {
      return NextResponse.json({
        ok: true,
        items: [],
      });
    }

    const admin = supabaseAdmin();

    let query = admin
      .from("route_lock_roster_v")
      .select(
        "assignment_id,tech_id,full_name,co_name,assignment_active,end_date",
      )
      .in("pc_org_id", coveredOrgIds)
      .limit(Math.max(limit * 4, 40));

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,tech_id.ilike.%${q}%`);
    }

    const { data, error } = await query.order("full_name", {
      ascending: true,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();

    const items = (data ?? [])
      .map((r: any) => ({
        assignment_id: clean(r?.assignment_id),
        person_id: "",
        tech_id: clean(r?.tech_id),
        full_name: clean(r?.full_name),
        co_name: r?.co_name == null ? null : String(r.co_name),
        assignment_active: !!r?.assignment_active,
        end_date: r?.end_date == null ? null : String(r.end_date),
      }))
      .filter((r) => r.assignment_id && r.tech_id && r.full_name)
      .filter((r) => affiliateAssignmentIds.has(r.assignment_id))
      .filter((r) => {
        if (!r.assignment_active) return false;
        if (!r.end_date) return true;
        return String(r.end_date) >= today;
      })
      .filter((r) => {
        const key = `${r.assignment_id}::${r.tech_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit)
      .map(({ assignment_active: _active, end_date: _end, ...rest }) => ({
        ...rest,
        is_bp_affiliate: true,
      }));

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(error?.message ?? "server_error"),
      },
      { status: Number(error?.status ?? 500) },
    );
  }
}