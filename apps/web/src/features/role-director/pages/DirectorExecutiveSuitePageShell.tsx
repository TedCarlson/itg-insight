import { PageHeader, PageShell } from "@/components/ui/PageShell";
import DirectorExecutiveSuiteClient from "../components/DirectorExecutiveSuiteClient";
import { getDirectorExecutivePayload } from "../lib/getDirectorExecutivePayload.server";
import type { MetricsRangeKey } from "@/shared/types/metrics/surfacePayload";

type DirectorDimensionKey = "overview" | "workforce" | "metrics" | "route-lock";

function normalizeRange(value: string | undefined): MetricsRangeKey {
  const upper = String(value ?? "FM").trim().toUpperCase();
  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

function normalizeDimension(value: string | undefined): DirectorDimensionKey {
  const normalized = String(value ?? "overview").trim().toLowerCase();

  if (normalized === "workforce") return "workforce";
  if (normalized === "metrics") return "metrics";
  if (normalized === "route-lock" || normalized === "routelock") return "route-lock";

  return "overview";
}

export default async function DirectorExecutiveSuitePageShell(props: {
  range?: string;
  dimension?: string;
}) {
  const payload = await getDirectorExecutivePayload({
    range: normalizeRange(props.range),
  });

  return (
    <PageShell>
      <PageHeader
        title="Director Suite"
        subtitle="Executive operating layer across Workforce, Metrics, and Route-Lock."
      />

      <DirectorExecutiveSuiteClient
        payload={payload}
        activeDimension={normalizeDimension(props.dimension)}
      />
    </PageShell>
  );
}