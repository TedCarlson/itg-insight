// path: apps/web/src/shared/ui/workforce/MetricInspectionDrawer.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

import type { ScorecardTile } from "@/shared/kpis/core/scorecardTypes";
import type { KpiBandKey as BandKey } from "@/shared/kpis/core/types";

import type {
  InspectionDrawerModel,
  InspectionMetricCell,
} from "@/shared/kpis/contracts/inspectionTypes";

function bandAccentClass(bandKey: string) {
  if (bandKey === "EXCEEDS") return "bg-[var(--to-success)]";
  if (bandKey === "MEETS") return "bg-[var(--to-primary)]";
  if (bandKey === "NEEDS_IMPROVEMENT") return "bg-[var(--to-warning)]";
  if (bandKey === "MISSES") return "bg-[var(--to-danger)]";
  return "bg-[var(--to-border)]";
}

function bandCardClass(bandKey: string, active: boolean) {
  const ring = active ? "ring-2 ring-[var(--to-accent)]" : "";

  if (bandKey === "EXCEEDS") {
    return `border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)] ${ring}`;
  }
  if (bandKey === "MEETS") {
    return `border-[var(--to-primary)] bg-[color-mix(in_oklab,var(--to-primary)_10%,white)] ${ring}`;
  }
  if (bandKey === "NEEDS_IMPROVEMENT") {
    return `border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_10%,white)] ${ring}`;
  }
  if (bandKey === "MISSES") {
    return `border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_10%,white)] ${ring}`;
  }

  return `border-[var(--to-border)] bg-muted/10 ${ring}`;
}

function bandTextLabel(bandKey: string) {
  if (bandKey === "EXCEEDS") return "Exceeds";
  if (bandKey === "MEETS") return "Meets";
  if (bandKey === "NEEDS_IMPROVEMENT") return "Needs Improvement";
  if (bandKey === "MISSES") return "Misses";
  return "No Data";
}

function bandLabel(bandKey: BandKey): string {
  if (bandKey === "EXCEEDS") return "Exceeds";
  if (bandKey === "MEETS") return "Meets";
  if (bandKey === "NEEDS_IMPROVEMENT") return "Needs Improvement";
  if (bandKey === "MISSES") return "Misses";
  return "No Data";
}

function bandPaint(bandKey: BandKey) {
  if (bandKey === "EXCEEDS") {
    return {
      preset: "BAND_EXCEEDS",
      bg: "var(--to-surface-2)",
      border: "var(--to-success)",
      ink: null,
    };
  }
  if (bandKey === "MEETS") {
    return {
      preset: "BAND_MEETS",
      bg: "var(--to-surface-2)",
      border: "var(--to-primary)",
      ink: null,
    };
  }
  if (bandKey === "NEEDS_IMPROVEMENT") {
    return {
      preset: "BAND_NEEDS_IMPROVEMENT",
      bg: "var(--to-surface-2)",
      border: "var(--to-warning)",
      ink: null,
    };
  }
  if (bandKey === "MISSES") {
    return {
      preset: "BAND_MISSES",
      bg: "var(--to-surface-2)",
      border: "var(--to-danger)",
      ink: null,
    };
  }

  return {
    preset: "BAND_NO_DATA",
    bg: "var(--to-surface-2)",
    border: "var(--to-border)",
    ink: null,
  };
}

function toScorecardTile(metric: InspectionMetricCell): ScorecardTile {
  const bandKey = (metric.band_key ?? "NO_DATA") as BandKey;

  return {
    kpi_key: metric.kpi_key,
    label: metric.label,
    value: metric.value ?? null,
    value_display: metric.value_display ?? null,
    band: {
      band_key: bandKey,
      label: bandLabel(bandKey),
      paint: bandPaint(bandKey),
    },
    momentum: {
      state: "stable",
      delta: null,
      delta_display: null,
      arrow: null,
      windows: { short_days: 7, long_days: 30 },
      notes: null,
    },
    context: {
      sample_short: null,
      sample_long: null,
      meets_min_volume: null,
    },
  };
}

type Props = {
  open: boolean;
  name: string;
  context?: string | null;
  metrics?: InspectionMetricCell[];
  initialSelectedKpi?: string | null;
  loadPayload?: (kpiKey: string) => Promise<any>;
  buildModel?: (args: {
    metric: InspectionMetricCell;
    tile: ScorecardTile;
    payload: any;
  }) => InspectionDrawerModel | null;
  onClose: () => void;
};

export default function MetricInspectionDrawer(props: Props) {
  const {
    open,
    name,
    context,
    metrics: rawMetrics,
    initialSelectedKpi,
    loadPayload,
    buildModel,
    onClose,
  } = props;

  const metrics = useMemo(() => rawMetrics ?? [], [rawMetrics]);

  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const firstMetricKey = metrics[0]?.kpi_key ?? null;

  const requestedKpi = useMemo(() => {
    if (!initialSelectedKpi) return null;
    return metrics.some((metric) => metric.kpi_key === initialSelectedKpi)
      ? initialSelectedKpi
      : null;
  }, [initialSelectedKpi, metrics]);

  useEffect(() => {
    if (!open) {
      setSelectedKpi(null);
      setPayload(null);
      setLoading(false);
      return;
    }

    const nextSelectedKpi = requestedKpi ?? firstMetricKey ?? null;

    setSelectedKpi((prev) => (prev === nextSelectedKpi ? prev : nextSelectedKpi));
  }, [open, requestedKpi, firstMetricKey]);

  useEffect(() => {
    if (!open || !selectedKpi || !loadPayload) return;

    const currentKpi = selectedKpi;
    const currentLoadPayload: (kpiKey: string) => Promise<any> = loadPayload;
    let cancelled = false;

    async function run() {
      setLoading(true);

      try {
        const data = await currentLoadPayload(currentKpi);
        if (!cancelled) setPayload(data);
      } catch {
        if (!cancelled) setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [open, selectedKpi, loadPayload]);

  const activeMetric = useMemo(() => {
    if (metrics.length === 0 || !selectedKpi) return null;
    return metrics.find((m) => m.kpi_key === selectedKpi) ?? null;
  }, [metrics, selectedKpi]);

  const activeTile = useMemo(() => {
    return activeMetric ? toScorecardTile(activeMetric) : null;
  }, [activeMetric]);

  const model = useMemo(() => {
    if (!activeMetric || !activeTile || !payload || !buildModel) return null;

    return buildModel({
      metric: activeMetric,
      tile: activeTile,
      payload,
    });
  }, [activeMetric, activeTile, payload, buildModel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full justify-end">
        <Card
          className="flex h-full w-full max-w-[1240px] flex-col overflow-hidden rounded-none border-l p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b px-5 py-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{name}</div>
                {context ? (
                  <div className="text-sm text-muted-foreground">{context}</div>
                ) : null}
              </div>

              <button
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={onClose}
                type="button"
              >
                Close
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_150px]">
              <div className="min-h-0 overflow-y-auto px-5 py-5">
                {metrics.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No metrics available.
                  </div>
                ) : !model ? (
                  <div className="text-sm text-muted-foreground">
                    {loading ? "Loading…" : "No data"}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {model.extraSections?.map((section, i) => (
                      <div key={i}>{section}</div>
                    ))}

                    {model.chart ? (
                      <div className="rounded-2xl border p-4">{model.chart}</div>
                    ) : null}

                    {model.periodDetail ? model.periodDetail : null}
                  </div>
                )}
              </div>

              <aside className="min-h-0 border-t lg:border-l lg:border-t-0">
                <div className="flex h-full min-h-0 flex-col px-3 py-4">
                  <div className="mb-3 shrink-0 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Metrics
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pb-1 pl-1 pr-1 pt-1">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                      {metrics.map((m) => {
                        const isActive = selectedKpi === m.kpi_key;

                        return (
                          <button
                            key={m.kpi_key}
                            type="button"
                            onClick={() => {
                              if (selectedKpi !== m.kpi_key) {
                                setSelectedKpi(m.kpi_key);
                                setPayload(null);
                              }
                            }}
                            className={[
                              "w-full overflow-hidden rounded-lg border text-left",
                              bandCardClass(m.band_key, isActive),
                            ].join(" ")}
                            title={`${m.label} • ${bandTextLabel(m.band_key)}`}
                          >
                            <div
                              className={`h-[3px] w-full ${bandAccentClass(m.band_key)}`}
                            />
                            <div className="px-2.5 py-2">
                              <div className="text-[10px] font-medium uppercase tracking-wide leading-tight text-foreground/90">
                                {m.label}
                              </div>
                              <div className="mt-1 text-[10px] leading-tight text-muted-foreground">
                                {bandTextLabel(m.band_key)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}