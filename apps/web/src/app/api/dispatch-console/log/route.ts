import { NextResponse, type NextRequest } from "next/server";

import { requireModule } from "@/shared/access/access";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

import { createDispatchLog } from "@/shared/server/dispatch/actions/createDispatchLog.server";
import { deleteDispatchLog } from "@/shared/server/dispatch/actions/deleteDispatchLog.server";
import { updateDispatchLog } from "@/shared/server/dispatch/actions/updateDispatchLog.server";
import { loadDispatchLogs } from "@/shared/server/dispatch/loaders/loadDispatchLogs.server";
import {
  parseDispatchLogCreateBody,
  parseDispatchLogDeleteInput,
  parseDispatchLogGetQuery,
  parseDispatchLogUpdateBody,
} from "@/shared/server/dispatch/validators/dispatchLogSchemas";
import {
  mapDispatchLogRowForResponse,
  mapDispatchLogRowsForResponse,
} from "@/shared/server/dispatch/mappers/mapDispatchLogResponse.server";
import { DispatchApiError } from "@/shared/server/dispatch/utils/dispatchErrors";

export const runtime = "nodejs";

function jsonError(status: number, payload: unknown) {
  return NextResponse.json(payload, { status });
}

function asRouteError(err: unknown) {
  const status = (err as any)?.status ?? 500;
  const message = String((err as any)?.message ?? "server_error");

  if (err instanceof DispatchApiError) {
    return jsonError(err.status, {
      ok: false,
      error: err.code,
      details: err.details,
    });
  }

  if (status === 401) return jsonError(401, { ok: false, error: "unauthorized" });
  if (status === 403) return jsonError(403, { ok: false, error: "forbidden" });
  if (status === 400) return jsonError(400, { ok: false, error: message });

  return jsonError(500, { ok: false, error: "server_error" });
}

async function requireDispatchAccess(req: NextRequest, pc_org_id: string) {
  const pass = await requireAccessPass(req, pc_org_id);
  requireModule(pass, "dispatch_console");
  return pass;
}

export async function GET(req: NextRequest) {
  try {
    const input = parseDispatchLogGetQuery(req.nextUrl.searchParams);
    await requireDispatchAccess(req, input.pc_org_id);

    const admin = supabaseAdmin();
    const rows = await loadDispatchLogs(admin, input);
    const responseRows = await mapDispatchLogRowsForResponse(admin, rows);

    return NextResponse.json({ ok: true, rows: responseRows }, { status: 200 });
  } catch (err) {
    return asRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    const pcOrgId = rawBody && typeof rawBody === "object" ? String((rawBody as any).pc_org_id ?? "").trim() : "";

    const pass = await requireDispatchAccess(req, pcOrgId);
    const input = parseDispatchLogCreateBody(rawBody, pass.auth_user_id);

    const admin = supabaseAdmin();
    const row = await createDispatchLog(admin, input);
    const responseRow = await mapDispatchLogRowForResponse(admin, row);

    return NextResponse.json({ ok: true, row: responseRow }, { status: 200 });
  } catch (err) {
    return asRouteError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    const pcOrgId = rawBody && typeof rawBody === "object" ? String((rawBody as any).pc_org_id ?? "").trim() : "";

    const pass = await requireDispatchAccess(req, pcOrgId);
    const input = parseDispatchLogUpdateBody(rawBody, pass.auth_user_id);

    const admin = supabaseAdmin();
    const row = await updateDispatchLog(admin, input);
    const responseRow = await mapDispatchLogRowForResponse(admin, row);

    return NextResponse.json({ ok: true, row: responseRow }, { status: 200 });
  } catch (err) {
    return asRouteError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    const pcOrgId =
      rawBody && typeof rawBody === "object"
        ? String((rawBody as any).pc_org_id ?? req.nextUrl.searchParams.get("pc_org_id") ?? "").trim()
        : String(req.nextUrl.searchParams.get("pc_org_id") ?? "").trim();

    const pass = await requireDispatchAccess(req, pcOrgId);
    const input = parseDispatchLogDeleteInput({
      body: rawBody,
      searchParams: req.nextUrl.searchParams,
      auth_user_id: pass.auth_user_id,
    });

    const admin = supabaseAdmin();
    await deleteDispatchLog(admin, input);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return asRouteError(err);
  }
}