// apps/web/src/app/api/internal/metrics/process-queue/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("Missing CRON_SECRET");
  }

  const secret = req.nextUrl.searchParams.get("secret");
  return secret === cronSecret;
}

async function runWorkerPass(admin: ReturnType<typeof supabaseAdmin>) {
  const { error } = await admin.rpc("process_next_metrics_job");

  if (error) {
    throw new Error(error.message);
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    const admin = supabaseAdmin();

    const maxJobsRaw = req.nextUrl.searchParams.get("max_jobs");
    const maxJobsParsed = Number(maxJobsRaw ?? "3");
    const maxJobs =
      Number.isFinite(maxJobsParsed) && maxJobsParsed > 0
        ? Math.min(Math.floor(maxJobsParsed), 10)
        : 3;

    for (let i = 0; i < maxJobs; i += 1) {
      await runWorkerPass(admin);
    }

    const { data: queueRows, error: queueError } = await admin
      .from("metrics_pipeline_queue")
      .select(
        "job_id,batch_id,status,attempts,created_at,started_at,finished_at,error"
      )
      .order("created_at", { ascending: false })
      .limit(10);

    if (queueError) {
      throw new Error(queueError.message);
    }

    return json(200, {
      ok: true,
      ran: maxJobs,
      queue: queueRows ?? [],
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: String(e?.message ?? e),
    });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}