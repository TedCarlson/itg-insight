// path: apps/web/src/app/api/route-lock/check-in/upload/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { ingestCheckInUpload } from "@/shared/server/route-lock/check-in/checkInUploadService.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, payload: unknown) {
  return NextResponse.json(payload, { status });
}

function errorPayload(error: unknown) {
  const e = error as any;

  return {
    ok: false,
    error: String(e?.message ?? "server_error"),
    hint: e?.hint ?? undefined,
    expected: e?.expected ?? undefined,
    received: e?.received ?? undefined,
    detail: e?.detail ?? e?.stack ?? undefined,
  };
}

function getFiscalMonthIds(result: unknown): string[] {
  const raw = (result as any)?.fiscal_month_ids;

  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(
      raw
        .map((v: unknown) => String(v))
        .filter((v: string) => Boolean(v))
    )
  );
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireSelectedPcOrgServer();
    if (!scope.ok) {
      return json(401, { ok: false, error: "no org selected" });
    }

    const sb = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user ?? null;

    if (!user) {
      return json(401, { ok: false, error: "not authenticated" });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return json(400, { ok: false, error: "missing file" });
    }

    const result = await ingestCheckInUpload({
      admin,
      pcOrgId: scope.selected_pc_org_id,
      uploadedByAuthUserId: user.id,
      file,
    });

    const fiscalMonthIds = getFiscalMonthIds(result);
    const sweeps: Record<string, unknown> = {};

    for (const fiscalMonthId of fiscalMonthIds) {
      const { data: sweepRes, error: sweepErr } = await admin.rpc("route_lock_sweep_month", {
        p_pc_org_id: scope.selected_pc_org_id,
        p_fiscal_month_id: fiscalMonthId,
      });

      if (sweepErr) {
        return json(500, {
          ok: false,
          error: `check-in uploaded but sweep failed for fiscal_month_id=${fiscalMonthId}: ${sweepErr.message}`,
          result,
        });
      }

      sweeps[fiscalMonthId] = sweepRes ?? null;
    }

    return json(200, {
      ...(result as any),
      sweep_count: fiscalMonthIds.length,
      sweeps,
    });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return json(status, errorPayload(error));
  }
}