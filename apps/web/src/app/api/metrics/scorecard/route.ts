import { NextRequest, NextResponse } from "next/server";

import { getTechScorecardPayload } from "@/features/metrics/scorecard";
import {
  getTechMetricsRangePayload,
  type MetricsRangeKey,
} from "@/features/tech/metrics/lib/getTechMetricsRangePayload.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { hasCapability } from "@/shared/access/access";
import { CAP } from "@/shared/access/capabilities";

export const runtime = "nodejs";

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function normalizeRange(value: string | null): MetricsRangeKey {
  const upper = String(value ?? "FM").toUpperCase();
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

export async function GET(req: NextRequest) {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) return json(401, { ok: false, error: "unauthorized" });

  const pc_org_id = scope.selected_pc_org_id;

  let pass: any;
  try {
    pass = await requireAccessPass(req, pc_org_id);
  } catch (err: any) {
    if (err?.status === 401) {
      return json(401, { ok: false, error: "unauthorized" });
    }
    if (err?.status === 403) {
      return json(403, { ok: false, error: "forbidden" });
    }
    if (err?.status === 400) {
      return json(400, {
        ok: false,
        error: err?.message ?? "invalid_pc_org_id",
      });
    }
    return json(500, { ok: false, error: "access_pass_failed" });
  }

  const isOwner = Boolean(pass?.is_app_owner) || Boolean(pass?.is_owner);
  if (!isOwner) {
    const allowed =
      hasCapability(pass, CAP.METRICS_MANAGE) ||
      hasCapability(pass, CAP.ROSTER_MANAGE);

    if (!allowed) {
      return json(403, { ok: false, error: "forbidden" });
    }
  }

  const url = new URL(req.url);
  const person_id = url.searchParams.get("person_id") ?? "me";
  const range = normalizeRange(url.searchParams.get("range"));

  const payload =
    range === "FM"
      ? await getTechScorecardPayload({ person_id })
      : await getTechMetricsRangePayload({ person_id, range });

  return NextResponse.json(payload);
}