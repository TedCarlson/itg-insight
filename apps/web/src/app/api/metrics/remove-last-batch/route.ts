// apps/web/src/app/api/metrics/remove-last-batch/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Retired endpoint.
 *
 * Removing "last batch" is unsafe once multiple orgs and same-day batches exist.
 * Replacement should delete an exact metric_batch_id from the upload history grid.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "retired_endpoint",
      message:
        "Remove-last-batch is retired. Use exact batch deletion from upload history instead.",
    },
    { status: 410 },
  );
}
