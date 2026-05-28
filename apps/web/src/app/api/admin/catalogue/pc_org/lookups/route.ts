import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  // signed-in gate (service role remains server-only)
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const [pcs, msos, divisions, regions, states] = await Promise.all([
    admin.from("pc").select("pc_id, pc_number").order("pc_number", { ascending: true }).limit(5000),
    admin.from("mso").select("mso_id, mso_name, mso_lob").order("mso_name", { ascending: true }).limit(5000),
    admin.from("division").select("division_id, division_name, division_code").order("division_name", { ascending: true }).limit(5000),
    admin.from("region").select("region_id, region_name, region_code").order("region_name", { ascending: true }).limit(5000),
    admin.from("locate_state_resource").select("state_code, state_name").order("state_code", { ascending: true }).limit(5000),
  ]);

  const firstErr = pcs.error || msos.error || divisions.error || regions.error || states.error;
  if (firstErr) return NextResponse.json({ error: firstErr.message }, { status: 500 });

  return NextResponse.json({
    pc: (pcs.data ?? []).map((r: any) => ({
      id: String(r.pc_id),
      label: r.pc_number != null ? `PC ${r.pc_number}` : String(r.pc_id),
      sublabel: String(r.pc_id),
    })),
    mso: (msos.data ?? []).map((r: any) => ({
      id: String(r.mso_id),
      label: r.mso_lob ? `${r.mso_name} (${r.mso_lob})` : String(r.mso_name),
      sublabel: String(r.mso_id),
    })),
    division: (divisions.data ?? []).map((r: any) => ({
      id: String(r.division_id),
      label: r.division_code ? `${r.division_name} (${r.division_code})` : String(r.division_name),
      sublabel: String(r.division_id),
    })),
    region: (regions.data ?? []).map((r: any) => ({
      id: String(r.region_id),
      label: r.region_code ? `${r.region_name} (${r.region_code})` : String(r.region_name),
      sublabel: String(r.region_id),
    })),
    state: (states.data ?? []).map((r: any) => ({
      id: String(r.state_code),
      label: r.state_name ? `${r.state_code} — ${r.state_name}` : String(r.state_code),
      sublabel: String(r.state_code),
    })),
  });
}