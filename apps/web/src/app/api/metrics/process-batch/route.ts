// apps/web/src/app/api/metrics/process-batch/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Retired endpoint.
 *
 * The core metrics upload spine now processes TPR uploads directly through:
 *   public.metrics_upload_tpr_batch()
 *
 * That function writes:
 *   core.metric_batches
 *   core.metric_rows
 *   core.metric_scores_fact
 *
 * and marks the batch complete in one workflow.
 *
 * This endpoint previously drove the legacy public metrics raw queue.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "retired_endpoint",
      message:
        "Legacy metrics process-batch is retired. Core upload now processes batches during upload.",
    },
    { status: 410 },
  );
}
