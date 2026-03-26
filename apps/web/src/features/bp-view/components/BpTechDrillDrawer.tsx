"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

import type {
  BpRangeKey,
  BpViewRosterMetricCell,
  BpViewRosterRow,
} from "../lib/bpView.types";

import type {
  BandKey,
  ScorecardTile,
} from "@/features/metrics/scorecard/lib/scorecard.types";

import { buildFtrDrawerModel } from "@/features/tech/metrics/lib/buildFtrDrawerModel";
import { buildToolUsageDrawerModel } from "@/features/tech/metrics/lib/buildToolUsageDrawerModel";
import { buildPurePassDrawerModel } from "@/features/tech/metrics/lib/buildPurePassDrawerModel";
import { build48HrDrawerModel } from "@/features/tech/metrics/lib/build48HrDrawerModel";
import { buildRepeatDrawerModel } from "@/features/tech/metrics/lib/buildRepeatDrawerModel";
import { buildSoiDrawerModel } from "@/features/tech/metrics/lib/buildSoiDrawerModel";
import { buildReworkDrawerModel } from "@/features/tech/metrics/lib/buildReworkDrawerModel";
import { buildMetDrawerModel } from "@/features/tech/metrics/lib/buildMetDrawerModel";

import BpMetricSparkline from "./BpMetricSparkline";
import MetricPeriodDetailTable from "./MetricPeriodDetailTable";
import BpTnpsSentimentMix from "./BpTnpsSentimentMix";

function mapBpRangeToTechRange(range: "FM" | "PREVIOUS" | "3FM" | "12FM") {
  if (range === "PREVIOUS") return "FM";
  return range;
}

type DrawerModel = {
  summaryRows: Array<{ label: string; value: string }>;
  chart: ReactNode;
  periodDetail?: ReactNode;
  extraSections?: ReactNode[];
};

type DrillApiResponse =
  | {
      ok: true;
      kpi_key: string;
      payload: any;
    }
  | {
      ok: false;
      error?: string;
    };

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

function toScorecardTile(metric: BpViewRosterMetricCell): ScorecardTile {
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
    momentum: ({
      state: "STABLE",
      delta: null,
      delta_display: null,
      arrow: null,
      windows: {
        short_days: 7,
        long_days: 30,
      },
      notes: null,
    } as unknown) as ScorecardTile["momentum"],
    context: {
      sample_short: null,
      sample_long: null,
      meets_min_volume: null,
    },
  };
}

function fmtNum(value: number | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}

function computeTnpsScore(
  surveys: number,
  promoters: number,
  detractors: number
): number | null {
  if (surveys > 0) return (100 * (promoters - detractors)) / surveys;
  return null;
}

function buildRangeTnpsValue(
  rows: Array<{
    tnps_surveys: number | null;
    tnps_promoters: number | null;
    tnps_detractors: number | null;
  }>
) {
  const surveys = rows.reduce((sum, row) => sum + (row.tnps_surveys ?? 0), 0);
  const promoters = rows.reduce(
    (sum, row) => sum + (row.tnps_promoters ?? 0),
    0
  );
  const detractors = rows.reduce(
    (sum, row) => sum + (row.tnps_detractors ?? 0),
    0
  );
  return fmtNum(computeTnpsScore(surveys, promoters, detractors), 2);
}

function buildBpTnpsDrawerModel(args: {
  payload: any;
  activeRange: BpRangeKey;
}): DrawerModel {
  const selectedRows = args.payload?.debug?.selected_final_rows ?? [];
  const trend = args.payload?.debug?.trend ?? args.payload?.trend ?? [];

  const currentRows = selectedRows.slice(0, 1);
  const last3Rows = selectedRows.slice(0, 3);
  const last12Rows = selectedRows;

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: "Current FM", value: buildRangeTnpsValue(currentRows) },
  ];

  if (args.activeRange !== "FM") {
    summaryRows.push({
      label: "Last 3 FM",
      value: buildRangeTnpsValue(last3Rows),
    });
  }

  if (args.activeRange === "12FM") {
    summaryRows.push({
      label: "Last 12 FM",
      value: buildRangeTnpsValue(last12Rows),
    });
  }

  const totalSurveys =
    args.payload?.summary?.tnps_surveys ??
    selectedRows.reduce(
      (sum: number, row: any) => sum + (row.tnps_surveys ?? 0),
      0
    );

  const totalPromoters =
    args.payload?.summary?.tnps_promoters ??
    selectedRows.reduce(
      (sum: number, row: any) => sum + (row.tnps_promoters ?? 0),
      0
    );

  const totalDetractors =
    args.payload?.summary?.tnps_detractors ??
    selectedRows.reduce(
      (sum: number, row: any) => sum + (row.tnps_detractors ?? 0),
      0
    );

  const totalScore = buildRangeTnpsValue(selectedRows);

  const sparkValues = trend.map((row: any) => ({
    value: row.kpi_value,
    isFinal: row.is_month_final,
  }));

  const periodRows = selectedRows.map((row: any) => {
    const score = fmtNum(
      computeTnpsScore(
        row.tnps_surveys ?? 0,
        row.tnps_promoters ?? 0,
        row.tnps_detractors ?? 0
      ),
      2
    );

    return {
      key: `${row.metric_date}-${row.batch_id}`,
      cells: [
        row.metric_date,
        score,
        row.tnps_surveys ?? "—",
        row.tnps_promoters ?? "—",
        row.tnps_detractors ?? "—",
      ],
    };
  });

  return {
    summaryRows,
    extraSections: [
      <BpTnpsSentimentMix
        key="tnps-sentiment-mix"
        totalSurveys={totalSurveys}
        totalPromoters={totalPromoters}
        totalDetractors={totalDetractors}
      />,
    ],
    chart: (
      <BpMetricSparkline
        label="tNPS Trend"
        values={sparkValues}
        headlineValue={args.payload?.summary?.tnps_score ?? null}
      />
    ),
    periodDetail: (
      <MetricPeriodDetailTable
        title="Period Detail"
        columns={[
          { key: "metric_date", label: "Metric Date" },
          {
            key: "tnps",
            label: "tNPS",
            align: "right",
            widthClass: "w-[80px]",
          },
          {
            key: "surveys",
            label: "Surveys",
            align: "right",
            widthClass: "w-[80px]",
          },
          {
            key: "prom",
            label: "Prom",
            align: "right",
            widthClass: "w-[80px]",
          },
          {
            key: "det",
            label: "Detr",
            align: "right",
            widthClass: "w-[80px]",
          },
        ]}
        rows={periodRows}
        footer={{
          key: "footer",
          cells: [
            "TOTAL",
            totalScore,
            totalSurveys || "—",
            totalPromoters || "—",
            totalDetractors || "—",
          ],
        }}
      />
    ),
  };
}

type RegistryEntry = {
  id: string;
  test: (metric: BpViewRosterMetricCell) => boolean;
  build: (args: {
    metric: BpViewRosterMetricCell;
    tile: ScorecardTile;
    payload: any;
    range: BpRangeKey;
  }) => DrawerModel | null;
};

const KPI_REGISTRY: RegistryEntry[] = [
  {
    id: "tnps",
    test: (metric) => {
      const k = metric.kpi_key.toLowerCase();
      return k.includes("tnps");
    },
    build: ({ payload, range }) =>
      buildBpTnpsDrawerModel({
        payload,
        activeRange: mapBpRangeToTechRange(range),
      }),
  },
  {
    id: "ftr",
    test: (metric) => metric.kpi_key.toLowerCase() === "ftr_rate",
    build: ({ tile, payload, range }) =>
      buildFtrDrawerModel({
        tile,
        ftrDebug: payload?.debug ?? null,
        activeRange: mapBpRangeToTechRange(range),
      }),
  },
  {
    id: "tool_usage",
    test: (metric) => {
      const k = metric.kpi_key.toLowerCase();
      return k.includes("tool_usage") || k.includes("toolusage");
    },
    build: ({ tile, payload, range }) =>
      buildToolUsageDrawerModel({
        tile,
        toolUsageDebug: payload?.debug ?? null,
        activeRange: mapBpRangeToTechRange(range),
      }),
  },
  {
    id: "pure_pass",
    test: (metric) => {
      const k = metric.kpi_key.toLowerCase();
      return k.includes("pure_pass") || k.includes("purepass");
    },
    build: ({ tile, payload, range }) =>
      buildPurePassDrawerModel({
        tile,
        purePassDebug: payload?.debug ?? null,
        activeRange: mapBpRangeToTechRange(range),
      }),
  },
  {
    id: "48hr",
    test: (metric) => {
      const k = metric.kpi_key.toLowerCase();
      return k.includes("48hr") || k.includes("48_hr") || k.includes("callback");
    },
    build: ({ tile, payload, range }) =>
      build48HrDrawerModel({
        tile,
        callback48HrDebug: payload?.debug ?? null,
        activeRange: mapBpRangeToTechRange(range),
      }),
  },
  {
    id: "repeat",
    test: (metric) => metric.kpi_key.toLowerCase().includes("repeat"),
    build: ({ tile, payload, range }) =>
      buildRepeatDrawerModel({
        tile,
        repeatDebug: payload?.debug ?? null,
        activeRange: mapBpRangeToTechRange(range),
      }),
  },
  {
    id: "soi",
    test: (metric) => metric.kpi_key.toLowerCase().includes("soi"),
    build: ({ tile, payload, range }) =>
      buildSoiDrawerModel({
        tile,
        soiDebug: payload?.debug ?? null,
        activeRange: mapBpRangeToTechRange(range),
      }),
  },
  {
    id: "rework",
    test: (metric) => metric.kpi_key.toLowerCase().includes("rework"),
    build: ({ tile, payload, range }) =>
      buildReworkDrawerModel({
        tile,
        reworkDebug: payload?.debug ?? null,
        activeRange: mapBpRangeToTechRange(range),
      }),
  },
  {
    id: "met",
    test: (metric) => {
      const k = metric.kpi_key.toLowerCase();
      return k === "met" || k === "met_rate" || k.includes("metrate");
    },
    build: ({ tile, payload, range }) =>
      buildMetDrawerModel({
        tile,
        metDebug: payload?.debug ?? null,
        activeRange: mapBpRangeToTechRange(range),
      }),
  },
];

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

export default function BpTechDrillDrawer(props: {
  open: boolean;
  row: BpViewRosterRow | null;
  range: BpRangeKey;
  onClose: () => void;
}) {
  const { open, row, range, onClose } = props;

  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const metrics = useMemo(() => row?.metrics ?? [], [row?.metrics]);

  const activeMetric = useMemo(() => {
    if (!metrics.length) return null;
    if (selectedKpi) {
      return metrics.find((m) => m.kpi_key === selectedKpi) ?? metrics[0];
    }
    return metrics[0];
  }, [metrics, selectedKpi]);

  const activeTile = useMemo<ScorecardTile | null>(() => {
    return activeMetric ? toScorecardTile(activeMetric) : null;
  }, [activeMetric]);

  const activeEntry = useMemo(() => {
    if (!activeMetric) return null;
    return KPI_REGISTRY.find((entry) => entry.test(activeMetric)) ?? null;
  }, [activeMetric]);

  useEffect(() => {
    if (!open || !row || !activeMetric || !activeEntry) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const currentRow = row;
    const metric = activeMetric;
    let cancelled = false;

    async function run() {
      setLoading(true);

      try {
        const qs = new URLSearchParams({
          person_id: currentRow.person_id,
          tech_id: currentRow.tech_id,
          range,
          kpi_key: metric.kpi_key,
        });

        const res = await fetch(`/api/bp-view/metric-drill?${qs.toString()}`);
        const json = (await res
          .json()
          .catch(() => null)) as DrillApiResponse | null;

        if (!cancelled) {
          if (res.ok && json?.ok) {
            setPayload(json.payload);
          } else {
            setPayload(null);
          }
        }
      } catch {
        if (!cancelled) {
          setPayload(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [open, row, activeMetric, activeEntry, range]);

  const nativeModel = useMemo(() => {
    if (!activeMetric || !activeTile || !activeEntry || !payload) return null;

    return activeEntry.build({
      metric: activeMetric,
      tile: activeTile,
      payload,
      range,
    });
  }, [activeMetric, activeTile, activeEntry, payload, range]);

  if (!open || !row || !activeMetric) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full justify-end">
        <Card
          className="flex h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-none border-l p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b px-5 py-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{row.full_name}</div>
                <div className="text-sm text-muted-foreground">{row.context}</div>
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

          <div className="space-y-5 overflow-y-auto px-5 py-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {metrics.map((m) => (
                <button
                  key={m.kpi_key}
                  type="button"
                  onClick={() => setSelectedKpi(m.kpi_key)}
                  className={[
                    "w-full overflow-hidden rounded-2xl border text-left transition active:scale-[0.99]",
                    bandCardClass(
                      m.band_key,
                      activeMetric.kpi_key === m.kpi_key
                    ),
                  ].join(" ")}
                >
                  <div className={`h-1.5 w-full ${bandAccentClass(m.band_key)}`} />
                  <div className="p-4">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.label}
                    </div>
                    <div className="mt-1 text-xl font-semibold leading-none">
                      {m.value_display ?? "—"}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {bandTextLabel(m.band_key)}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {!activeEntry ? (
              <div className="text-sm text-muted-foreground">
                No KPI registry entry found for this metric.
              </div>
            ) : !nativeModel ? (
              <div className="text-sm text-muted-foreground">
                {loading ? "Loading…" : "No data returned"}
              </div>
            ) : (
              <>
                <div className="rounded-2xl border p-4">
                  <div className="text-sm font-semibold">
                    {activeMetric.label} • {activeMetric.value_display ?? "—"}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {nativeModel.summaryRows.map((r) => (
                      <div
                        key={r.label}
                        className="rounded-xl border px-3 py-2"
                      >
                        <div className="text-[10px] uppercase text-muted-foreground">
                          {r.label}
                        </div>
                        <div className="text-sm font-semibold">{r.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {nativeModel.extraSections?.map((section, i) => (
                  <div key={i}>{section}</div>
                ))}

                <div className="rounded-2xl border p-4">{nativeModel.chart}</div>

                <div className="rounded-2xl border p-4">
                  {nativeModel.periodDetail ?? null}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}