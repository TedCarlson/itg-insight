"use client";

import type { CompanyManagerOfficeRollupRow } from "../lib/companyManagerView.types";

type MetricOrderItem = {
  kpi_key: string;
  label: string;
};

function formatMetricValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function bandPillClass(bandKey?: string | null) {
  if (bandKey === "EXCEEDS") {
    return "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]";
  }
  if (bandKey === "MEETS") {
    return "border-[var(--to-primary)] bg-[color-mix(in_oklab,var(--to-primary)_10%,white)]";
  }
  if (bandKey === "NEEDS_IMPROVEMENT") {
    return "border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_10%,white)]";
  }
  if (bandKey === "MISSES") {
    return "border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_10%,white)]";
  }
  return "border-[var(--to-border)] bg-muted/10";
}

function getMetricOrder(row: CompanyManagerOfficeRollupRow): MetricOrderItem[] {
  return row.metric_order ?? [];
}

function getMetricSummary(row: CompanyManagerOfficeRollupRow, kpiKey: string) {
  return row.metrics.get(kpiKey) ?? null;
}

function getBelowTargetCount(row: CompanyManagerOfficeRollupRow) {
  return row.below_target_count ?? 0;
}

function MetricPill(props: {
  label: string;
  value: number | null;
  band?: string | null;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div
        className={[
          "inline-flex min-w-[64px] items-center justify-center rounded-md border px-2 py-1 text-sm font-medium",
          bandPillClass(props.band),
        ].join(" ")}
      >
        {formatMetricValue(props.value)}
      </div>
    </div>
  );
}

export default function CompanyManagerOfficePulseCard(props: {
  rows: CompanyManagerOfficeRollupRow[];
}) {
  const { rows } = props;

  if (!rows.length) {
    return (
      <section className="rounded-2xl border bg-card p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Office Pulse
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          No office pulse data in scope.
        </div>
      </section>
    );
  }

  const metricOrder = getMetricOrder(rows[0]).slice(0, 3);

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Office Pulse
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Primary KPI health by office
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {rows.length} office{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-2xl border">
        <div
          className="grid border-b bg-muted/10"
          style={{
            gridTemplateColumns: `180px repeat(${metricOrder.length}, minmax(92px, 1fr)) 76px`,
            minWidth: "620px",
          }}
        >
          <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground">
            Office
          </div>

          {metricOrder.map((metric: MetricOrderItem) => (
            <div
              key={metric.kpi_key}
              className="px-3 py-2 text-center text-[11px] font-medium text-muted-foreground"
            >
              {metric.label}
            </div>
          ))}

          <div className="px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">
            Risk
          </div>
        </div>

        {rows.map((row) => (
          <div
            key={row.office}
            className="grid border-b last:border-b-0"
            style={{
              gridTemplateColumns: `180px repeat(${metricOrder.length}, minmax(92px, 1fr)) 76px`,
              minWidth: "620px",
            }}
          >
            <div className="px-3 py-3 text-sm font-semibold">{row.office}</div>

            {metricOrder.map((metric: MetricOrderItem) => {
              const metricSummary = getMetricSummary(row, metric.kpi_key);

              return (
                <div
                  key={metric.kpi_key}
                  className="px-3 py-2 text-center"
                >
                  <MetricPill
                    label={metric.label}
                    value={metricSummary?.value ?? null}
                    band={metricSummary?.band ?? null}
                  />
                </div>
              );
            })}

            <div className="flex items-center justify-center px-3 py-3">
              <div className="inline-flex min-w-[44px] items-center justify-center rounded-md border border-[var(--to-border)] bg-muted/10 px-2 py-1 text-sm font-medium">
                {getBelowTargetCount(row)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}