// path: apps/web/src/shared/server/metrics/reports/rollupReport.kpis.server.ts

import { buildScopedExecutiveStrip } from "@/shared/lib/metrics/buildScopedExecutiveStrip";
import type { MetricsSurfacePayload } from "@/shared/types/metrics/surfacePayload";
import type { TeamRowClient } from "@/shared/lib/metrics/buildScopedRows";

export function readNumeric(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value.replace(/[,%]/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export function computeComposite(): number | null {
    return null;
}

export function buildKpis(args: {
    payload: MetricsSurfacePayload;
    rows: TeamRowClient[];
    visibleKpiKeys: string[];
}) {
    const exec = buildScopedExecutiveStrip({
        runtime: args.payload.executive_strip?.runtime ?? null,
        scopedRows: args.rows,
        fallbackItems: args.payload.executive_strip?.scope?.items ?? [],
    });

    return args.visibleKpiKeys.map((kpiKey) => {
        const item = exec.find((i: any) => i.kpi_key === kpiKey);

        const rawItem = item as any;

        return {
            kpi_key: kpiKey,
            label: rawItem?.label ?? kpiKey,
            value: readNumeric(rawItem?.value_display),
            value_display: rawItem?.value_display ?? "—",
            band_key: rawItem?.band_key ?? null,
        };
    });
}