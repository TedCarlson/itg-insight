import { NextRequest, NextResponse } from "next/server";

import { getMetricFtrPayload } from "@/features/tech/metrics/lib/getMetricFtrPayload.server";
import { getMetricTnpsPayload } from "@/features/tech/metrics/lib/getMetricTnpsPayload.server";
import { getMetricToolUsagePayload } from "@/features/tech/metrics/lib/getMetricToolUsagePayload.server";
import { getMetricPurePassPayload } from "@/features/tech/metrics/lib/getMetricPurePassPayload.server";
import { getMetric48HrPayload } from "@/features/tech/metrics/lib/getMetric48HrPayload.server";
import { getMetricRepeatPayload } from "@/features/tech/metrics/lib/getMetricRepeatPayload.server";
import { getMetricSoiPayload } from "@/features/tech/metrics/lib/getMetricSoiPayload.server";
import { getMetricReworkPayload } from "@/features/tech/metrics/lib/getMetricReworkPayload.server";
import { getMetricMetPayload } from "@/features/tech/metrics/lib/getMetricMetPayload.server";

type RangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

type DrillResponse = {
  ok: true;
  kpi_key: string;
  payload: unknown;
};

function badRequest(message: string) {
  return NextResponse.json(
    { ok: false, error: message },
    { status: 400 }
  );
}

function normalizeRange(value: string | null): RangeKey {
  if (value === "PREVIOUS") return "PREVIOUS";
  if (value === "3FM") return "3FM";
  if (value === "12FM") return "12FM";
  return "FM";
}

async function resolveMetricPayload(args: {
  person_id: string;
  tech_id: string;
  range: RangeKey;
  kpi_key: string;
}) {
  const { person_id, tech_id, range, kpi_key } = args;
  const key = kpi_key.toLowerCase();

  if (key === "ftr_rate") {
    return getMetricFtrPayload({ person_id, tech_id, range });
  }

  if (key === "tnps" || key === "tnps_score") {
    return getMetricTnpsPayload({ person_id, tech_id, range });
  }

  if (key === "tool_usage" || key === "toolusage" || key === "tool_usage_rate") {
    return getMetricToolUsagePayload({ person_id, tech_id, range });
  }

  if (
    key === "pure_pass" ||
    key === "purepass" ||
    key === "pht_pure_pass_rate"
  ) {
    return getMetricPurePassPayload({ person_id, tech_id, range });
  }

  if (
    key === "contact_48hr" ||
    key === "48hr_contact" ||
    key === "48_hr_contact" ||
    key === "contact_48hr_rate" ||
    key === "callback_48hr"
  ) {
    return getMetric48HrPayload({ person_id, tech_id, range });
  }

  if (key === "repeat" || key === "repeat_rate") {
    return getMetricRepeatPayload({ person_id, tech_id, range });
  }

  if (key === "soi" || key === "soi_rate") {
    return getMetricSoiPayload({ person_id, tech_id, range });
  }

  if (key === "rework" || key === "rework_rate") {
    return getMetricReworkPayload({ person_id, tech_id, range });
  }

  if (key === "met" || key === "met_rate") {
    return getMetricMetPayload({ person_id, tech_id, range });
  }

  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const person_id = url.searchParams.get("person_id");
  const tech_id = url.searchParams.get("tech_id");
  const kpi_key = url.searchParams.get("kpi_key");
  const range = normalizeRange(url.searchParams.get("range"));

  if (!person_id) return badRequest("Missing person_id");
  if (!tech_id) return badRequest("Missing tech_id");
  if (!kpi_key) return badRequest("Missing kpi_key");

  try {
    const payload = await resolveMetricPayload({
      person_id,
      tech_id,
      range,
      kpi_key,
    });

    if (!payload) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported KPI key: ${kpi_key}`,
        },
        { status: 404 }
      );
    }

    const response: DrillResponse = {
      ok: true,
      kpi_key,
      payload,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "metric-drill failed";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}