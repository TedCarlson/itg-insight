// path: apps/web/src/shared/surfaces/MetricsExecutiveKpiMatrix.tsx

"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import MetricsOrgDrillDrawer from "@/shared/surfaces/MetricsOrgDrillDrawer";
import type {
  MetricsExecutiveKpiItem,
  MetricsExecutiveStripRuntimePayload,
} from "@/shared/types/metrics/executiveStrip";

type MatrixRow = {
  label: string;
  subtitle?: string | null;
  items: MetricsExecutiveKpiItem[];
};

type Props = {
  title: string;
  subtitle?: string | null;
  rows: MatrixRow[];
  runtime?: MetricsExecutiveStripRuntimePayload | null;
};

type SelectedMatrixKpi = {
  row: MatrixRow;
  kpiKey: string;
};

function topBarClass(bandKey: string) {
  if (bandKey === "EXCEEDS") return "bg-[var(--to-success)]";
  if (bandKey === "MEETS") return "bg-[var(--to-primary)]";
  if (bandKey === "NEEDS_IMPROVEMENT") return "bg-[var(--to-warning)]";
  if (bandKey === "MISSES") return "bg-[var(--to-danger)]";
  return "bg-[var(--to-border)]";
}

function comparisonPillClass(state: "better" | "worse" | "neutral") {
  if (state === "better") {
    return "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]";
  }

  if (state === "worse") {
    return "border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_10%,white)]";
  }

  return "border-[var(--to-border)] bg-muted/10";
}

function comparisonLine(item: MetricsExecutiveKpiItem) {
  return `${item.comparison_scope_code} ${item.comparison_value_display}`;
}

function KpiTile({
  item,
  onClick,
}: {
  item: MetricsExecutiveKpiItem;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="overflow-hidden rounded-lg border bg-card text-left transition hover:-translate-y-[1px] hover:shadow-sm"
    >
      <div className={`h-1 w-full ${topBarClass(item.band_key)}`} />

      <div className="px-2 py-2">
        <div className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">
          {item.label}
        </div>

        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="text-[15px] font-semibold leading-none">
            {item.value_display ?? "—"}
          </div>

          <div className="whitespace-nowrap text-[9px] text-muted-foreground">
            {item.band_label}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="truncate text-[9px] text-muted-foreground">
            {comparisonLine(item)}
          </div>

          <div
            className={[
              "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8px] font-medium",
              comparisonPillClass(item.comparison_state),
            ].join(" ")}
          >
            {item.variance_display ?? "—"}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function MetricsExecutiveKpiMatrix(props: Props) {
  const [selected, setSelected] = useState<SelectedMatrixKpi | null>(null);
  const canOpenDrawer = !!props.runtime;

  return (
    <>
      <Card className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {props.title}
            </div>

            {props.subtitle ? (
              <div className="mt-1 text-[10px] text-muted-foreground">
                {props.subtitle}
              </div>
            ) : null}
          </div>

          <div className="text-[10px] text-muted-foreground">
            {props.rows.length} rows
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <div className="min-w-max divide-y">
            {props.rows.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                className="grid grid-cols-[190px_1fr] gap-3 p-3"
              >
                <div className="sticky left-0 z-10 bg-card/95 pr-3 backdrop-blur">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </div>

                  {row.subtitle ? (
                    <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
                      {row.subtitle}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-flow-col auto-cols-[160px] gap-2">
                  {row.items.map((item) => (
                    <KpiTile
                      key={item.kpi_key}
                      item={item}
                      onClick={
                        canOpenDrawer
                          ? () => setSelected({ row, kpiKey: item.kpi_key })
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {props.runtime ? (
        <MetricsOrgDrillDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          kpiKey={selected?.kpiKey ?? null}
          baseItems={selected?.row.items ?? []}
          scopeItems={null}
          runtime={props.runtime}
        />
      ) : null}
    </>
  );
}