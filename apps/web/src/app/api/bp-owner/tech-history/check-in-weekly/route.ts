// path: apps/web/src/app/api/bp-owner/tech-history/check-in-weekly/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { resolveBpOwnerScope } from "@/features/role-bp-owner/lib/resolveBpOwnerScope.server";
import { getTechCheckInWeeklyHistory } from "@/shared/server/route-lock/check-in/checkInWeeklyHistoryService.server";

export const runtime = "nodejs";

function json(status: number, payload: unknown) {
  return NextResponse.json(payload, { status });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function errorPayload(error: unknown) {
  const e = error as any;

  return {
    ok: false,
    error: String(e?.message ?? "server_error"),
    hint: e?.hint ?? undefined,
    detail: e?.detail ?? e?.stack ?? undefined,
  };
}

async function requireBpOwnerAssignment(assignmentId: string | null) {
  const requestedAssignmentId = clean(assignmentId);

  if (!requestedAssignmentId) {
    return {
      ok: false as const,
      status: 400,
      error: "Invalid assignment_id",
    };
  }

  const scope = await resolveBpOwnerScope();

  const matched = scope.scoped_assignments.find(
    (row) => clean(row.assignment_id) === requestedAssignmentId,
  );

  if (!matched) {
    return {
      ok: false as const,
      status: 403,
      error: "forbidden",
    };
  }

  const pcOrgId = clean(matched.pc_org_id);

  if (!pcOrgId) {
    return {
      ok: false as const,
      status: 409,
      error: "missing_pc_org_id",
    };
  }

  return {
    ok: true as const,
    pcOrgId,
  };
}

export async function GET(req: NextRequest) {
  try {
    const assignmentId = req.nextUrl.searchParams.get("assignment_id");

    const guard = await requireBpOwnerAssignment(assignmentId);

    if (!guard.ok) {
      return json(guard.status, {
        ok: false,
        error: guard.error,
      });
    }

    const result = await getTechCheckInWeeklyHistory({
      admin: supabaseAdmin(),
      pcOrgId: guard.pcOrgId,
      assignmentId,
      from: req.nextUrl.searchParams.get("from"),
      to: req.nextUrl.searchParams.get("to"),
    });

    return json(200, result);
  } catch (error: any) {
    return json(Number(error?.status ?? 500), errorPayload(error));
  }
}