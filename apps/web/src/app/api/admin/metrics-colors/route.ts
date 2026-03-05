// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/admin/metrics-colors/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

const TABLE = "metrics_band_style_selection";
const GLOBAL_SELECTION_KEY = "GLOBAL";

async function isOwner(sb: any) {
  try {
    const { data, error } = await sb.rpc("is_owner");
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

async function hasAnyRole(admin: any, auth_user_id: string, roleKeys: string[]) {
  const { data, error } = await admin.from("user_roles").select("role_key").eq("auth_user_id", auth_user_id);
  if (error) return false;
  const roles = (data ?? []).map((r: any) => String(r?.role_key ?? "")).filter(Boolean);
  return roles.some((rk: string) => roleKeys.includes(rk));
}

async function elevatedGate() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const admin = supabaseAdmin();
  const uid = user.id;

  const owner = await isOwner(sb);
  const elevated = owner || (await hasAnyRole(admin, uid, ["admin", "dev", "director", "vp"]));

  if (!elevated) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, admin };
}

// -------------------------------------------------------------
// GET — return active preset key (global row)
// -------------------------------------------------------------
export async function GET() {
  const gate = await elevatedGate();
  if (!gate.ok) return gate.res;

  const admin = gate.admin;

  const { data, error } = await admin
    .from(TABLE)
    .select("preset_key,selection_key")
    .eq("selection_key", GLOBAL_SELECTION_KEY)
    .maybeSingle();

  if (error) {
    console.error("Selection load error:", error);
    return NextResponse.json({ error: "Failed to load selection" }, { status: 500 });
  }

  return NextResponse.json({
    activePresetKey: data?.preset_key ?? null,
  });
}

// -------------------------------------------------------------
// POST — overwrite global selection (delete+insert avoids PK-update issues)
// -------------------------------------------------------------
export async function POST(req: NextRequest) {
  const gate = await elevatedGate();
  if (!gate.ok) return gate.res;

  const admin = gate.admin;

  const body = await req.json().catch(() => null);
  const presetKey = String(body?.preset_key ?? "").trim();

  if (!presetKey) {
    return NextResponse.json({ error: "Missing preset_key" }, { status: 400 });
  }

  const { error: delErr } = await admin.from(TABLE).delete().eq("selection_key", GLOBAL_SELECTION_KEY);
  if (delErr) {
    console.error("Selection delete error:", delErr);
    return NextResponse.json({ error: "Failed to clear selection" }, { status: 500 });
  }

  const { error: insErr } = await admin.from(TABLE).insert([
    {
      selection_key: GLOBAL_SELECTION_KEY,
      preset_key: presetKey,
      updated_at: new Date().toISOString(),
    },
  ]);

  if (insErr) {
    console.error("Selection save error:", insErr);
    return NextResponse.json({ error: "Failed to save selection" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, activePresetKey: presetKey });
}