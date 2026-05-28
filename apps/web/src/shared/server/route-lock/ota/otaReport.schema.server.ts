// path: apps/web/src/shared/server/route-lock/ota/otaReport.schema.server.ts

import type { OtaReportParams, OtaReportScope } from "./otaReportTypes";

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseOtaReportSearchParams(params: URLSearchParams): OtaReportParams {
  const rawScope = String(params.get("scope") ?? "").trim();
  const rawAnchor = String(params.get("anchor") ?? "").trim();

  const scope: OtaReportScope = rawScope === "month" ? "month" : "week";

  return {
    scope,
    anchor: isDateOnly(rawAnchor) ? rawAnchor : null,
  };
}
