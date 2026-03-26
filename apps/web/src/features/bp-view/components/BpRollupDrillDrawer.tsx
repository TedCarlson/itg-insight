"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";

import type {
  BpRollupContributorRow,
  BpRollupDrillPayload,
  BpRollupTnpsContributorRow,
  BpViewKpiItem,
} from "../lib/bpView.types";

import BpMetricSparkline from "./BpMetricSparkline";
import BpTnpsSentimentMix from "./BpTnpsSentimentMix";

type TnpsDensityMode = "all_checkpoints" | "monthly_finals";

function pillClass(bandKey?: string | null) {
  if (bandKey === "EXCEEDS") return "border-[var(--to-success)]";
  if (bandKey === "MEETS") return "border-[var(--to-primary)]";
  if (bandKey === "NEEDS_IMPROVEMENT") return "border-[var(--to-warning)]";
  if (bandKey === "MISSES") return "border-[var(--to-danger)]";
  return "border-[var(--to-border)]";
}

function SectionTitle(props: {
  title: string;
  subtitle?: string | null;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {props.title}
      </div>
      {props.subtitle ? (
        <div className="mt-1 text-sm text-muted-foreground">{props.subtitle}</div>
      ) : null}
    </div>
  );
}

function KpiRail(props: {
  items: BpViewKpiItem[];
  activeKey: string | null;
  onSelect: (item: BpViewKpiItem) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={props.onPrev}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm transition hover:bg-muted/40"
        aria-label="Previous KPI"
        title="Previous KPI"
      >
        ‹
      </button>

      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {props.items.map((item) => {
          const active = props.activeKey === item.kpi_key;

          return (
            <button
              key={item.kpi_key}
              type="button"
              onClick={() => props.onSelect(item)}
              className={[
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition",
                active
                  ? "border-[var(--to-primary)] bg-muted font-medium"
                  : "hover:bg-muted/40",
              ].join(" ")}
            >
              <span>{item.label}</span>
              <span className="opacity-70">{item.value_display ?? "—"}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={props.onNext}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm transition hover:bg-muted/40"
        aria-label="Next KPI"
        title="Next KPI"
      >
        ›
      </button>
    </div>
  );
}

function KpiVerdict(props: {
  kpi: NonNullable<BpRollupDrillPayload["selected_kpi"]>;
}) {
  const { kpi } = props;

  return (
    <Card className="p-4">
      <SectionTitle title="KPI Verdict" subtitle="Current value and comparison" />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="text-lg font-semibold">{kpi.label}</div>
        <div
          className={[
            "rounded-full border px-3 py-1 text-sm",
            pillClass(kpi.band_key),
          ].join(" ")}
        >
          {kpi.value_display ?? "—"} • {kpi.band_label}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Current
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {kpi.value_display ?? "—"}
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Prior
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {kpi.prior_value_display ?? "—"}
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Delta
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {kpi.delta_display ?? "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {kpi.delta_value == null ? "No prior comparison" : "Change vs prior"}
          </div>
        </div>
      </div>
    </Card>
  );
}

function KpiMath(props: {
  kpi: NonNullable<BpRollupDrillPayload["selected_kpi"]>;
}) {
  const { kpi } = props;

  if (
    !kpi.numerator_label &&
    !kpi.denominator_label &&
    !(kpi.fact_rows?.length ?? 0)
  ) {
    return null;
  }

  return (
    <Card className="p-4">
      <SectionTitle
        title="KPI Math"
        subtitle="Source math and supporting facts behind the current value"
      />

      {kpi.numerator_label || kpi.denominator_label ? (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {kpi.numerator_label ?? "Numerator"}
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {kpi.numerator ?? "—"}
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {kpi.denominator_label ?? "Denominator"}
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {kpi.denominator ?? "—"}
            </div>
          </div>
        </div>
      ) : null}

      {(kpi.fact_rows?.length ?? 0) > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {kpi.fact_rows?.map((row) => (
            <div
              key={`${row.label}-${row.value}`}
              className="rounded-xl border bg-muted/10 px-3 py-3"
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {row.label}
              </div>
              <div className="mt-1 text-sm font-semibold">{row.value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function TnpsDensityToggle(props: {
  value: TnpsDensityMode;
  onChange?: (value: TnpsDensityMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border bg-muted/20 p-1">
      <button
        type="button"
        onClick={() => props.onChange?.("all_checkpoints")}
        className={[
          "rounded-full px-3 py-1.5 text-xs transition",
          props.value === "all_checkpoints"
            ? "bg-background font-medium shadow-sm"
            : "text-muted-foreground hover:bg-muted/40",
        ].join(" ")}
      >
        All checkpoints
      </button>

      <button
        type="button"
        onClick={() => props.onChange?.("monthly_finals")}
        className={[
          "rounded-full px-3 py-1.5 text-xs transition",
          props.value === "monthly_finals"
            ? "bg-background font-medium shadow-sm"
            : "text-muted-foreground hover:bg-muted/40",
        ].join(" ")}
      >
        FM finals
      </button>
    </div>
  );
}

function KpiTrend(props: {
  kpi: NonNullable<BpRollupDrillPayload["selected_kpi"]>;
}) {
  const { kpi } = props;

  if (!kpi.trend?.length) return null;

  const values = kpi.trend.map((point) => ({
    value: point.value,
    isFinal: point.is_final === true,
  }));

  return (
    <Card className="p-4">
      <SectionTitle
        title="KPI Trend"
        subtitle="Movement across the selected inspection window"
      />

      <div className="mt-4">
        <BpMetricSparkline label={`${kpi.label} Trend`} values={values} />
      </div>
    </Card>
  );
}

function TnpsSentiment(props: {
  kpi: NonNullable<BpRollupDrillPayload["selected_kpi"]>;
}) {
  const s = props.kpi.sentiment_mix;
  if (!s) return null;

  return (
    <BpTnpsSentimentMix
      totalSurveys={s.surveys}
      totalPromoters={s.promoters}
      totalDetractors={s.detractors}
      title="Sentiment Mix"
    />
  );
}

function TnpsPeriodDetail(props: {
  kpi: NonNullable<BpRollupDrillPayload["selected_kpi"]>;
  densityMode: TnpsDensityMode;
  onDensityModeChange?: (value: TnpsDensityMode) => void;
}) {
  const rows = props.kpi.period_detail ?? [];
  if (!rows.length) return null;

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SectionTitle
          title="Period Detail"
          subtitle="Checkpoint detail for tNPS in the selected scope"
        />
        <TnpsDensityToggle
          value={props.densityMode}
          onChange={props.onDensityModeChange}
        />
      </div>

      <div className="mt-4 overflow-auto rounded-2xl border">
        <div
          className="grid min-w-[860px] border-b bg-muted/10"
          style={{
            gridTemplateColumns:
              "180px 140px 120px 120px 120px 120px 120px",
          }}
        >
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
            Metric Date
          </div>
          <div className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
            FM Container
          </div>
          <div className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
            tNPS
          </div>
          <div className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
            Surveys
          </div>
          <div className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
            Prom
          </div>
          <div className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
            Pass
          </div>
          <div className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
            Detr
          </div>
        </div>

        {rows.map((row) => (
          <div
            key={`${row.metric_date}-${row.fiscal_month_label ?? ""}`}
            className={[
              "grid border-b last:border-b-0",
              row.is_month_final === true ? "bg-muted/10" : "",
            ].join(" ")}
            style={{
              gridTemplateColumns:
                "180px 140px 120px 120px 120px 120px 120px",
            }}
          >
            <div className="px-3 py-2.5 text-sm">{row.metric_date}</div>
            <div className="px-3 py-2.5 text-sm text-muted-foreground">
              {row.fiscal_month_label ?? "—"}
              {row.is_month_final === true ? (
                <span className="ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  Final
                </span>
              ) : null}
            </div>
            <div className="px-3 py-2.5 text-center text-sm font-medium">
              {row.tnps_display ?? "—"}
            </div>
            <div className="px-3 py-2.5 text-center text-sm">{row.surveys}</div>
            <div className="px-3 py-2.5 text-center text-sm">{row.promoters}</div>
            <div className="px-3 py-2.5 text-center text-sm">{row.passives}</div>
            <div className="px-3 py-2.5 text-center text-sm">{row.detractors}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ToneChip(props: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const cls =
    props.tone === "success"
      ? "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_8%,white)]"
      : props.tone === "warning"
        ? "border-[#eab308] bg-[color-mix(in_oklab,#eab308_8%,white)]"
        : props.tone === "danger"
          ? "border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_8%,white)]"
          : "border-[var(--to-border)] bg-muted/10";

  return (
    <div className={["rounded-full border px-2.5 py-1 text-xs", cls].join(" ")}>
      <span className="font-medium">{props.label}</span>
      <span className="ml-1">{props.value}</span>
    </div>
  );
}

function TnpsContributionAnalysis(props: {
  rows: BpRollupTnpsContributorRow[];
}) {
  if (!props.rows.length) return null;

  const top = props.rows.slice(0, 10);

  return (
    <Card className="p-4">
      <SectionTitle
        title="Survey Contribution by Tech"
        subtitle="Sentiment composition driving this tNPS roll-up"
      />

      <div className="mt-4 space-y-2">
        {top.map((row) => (
          <div
            key={row.tech_id}
            className="flex flex-col gap-3 rounded-xl border px-3 py-3 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{row.full_name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <ToneChip label="Surveys" value={row.surveys} tone="neutral" />
                <ToneChip label="Pro" value={row.promoters} tone="success" />
                <ToneChip label="Pass" value={row.passives} tone="warning" />
                <ToneChip label="Det" value={row.detractors} tone="danger" />
              </div>
            </div>

            <div className="shrink-0 text-left md:text-right">
              <div className="text-base font-semibold">
                {row.tnps_display ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">tNPS</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ContributionAnalysis(props: {
  rows: BpRollupContributorRow[];
  kpiKey: string;
}) {
  if (!props.rows.length) return null;

  const title =
    props.kpiKey === "tnps" || props.kpiKey === "tnps_score"
      ? "Survey Contribution by Tech"
      : "Contribution Analysis";

  const subtitle =
    props.kpiKey === "tnps" || props.kpiKey === "tnps_score"
      ? "Techs contributing survey-weighted influence to this tNPS roll-up"
      : "Top contributors influencing this KPI";

  const top = props.rows.slice(0, 8);

  return (
    <Card className="p-4">
      <SectionTitle title={title} subtitle={subtitle} />

      <div className="mt-4 space-y-2">
        {top.map((row) => (
          <div
            key={row.tech_id}
            className="flex items-center justify-between rounded-xl border px-3 py-2"
          >
            <div className="text-sm">{row.full_name}</div>

            <div className="text-sm text-muted-foreground">
              {row.metric_value_display ?? "—"} ({row.work_total})
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScopeContext(props: {
  payload: BpRollupDrillPayload;
}) {
  const rates = props.payload.selected_kpi?.scope_context_rates ?? [];
  const sentiment = props.payload.selected_kpi?.sentiment_mix ?? null;

  return (
    <Card className="p-4">
      <SectionTitle
        title="Scope Context"
        subtitle="Background context for this inspected scope"
      />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border bg-muted/10 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Headcount
          </div>
          <div className="mt-1 text-sm font-semibold">{props.payload.headcount}</div>
        </div>

        <div className="rounded-xl border bg-muted/10 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Jobs
          </div>
          <div className="mt-1 text-sm font-semibold">{props.payload.work_mix.total}</div>
        </div>

        <div className="rounded-xl border bg-muted/10 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Installs
          </div>
          <div className="mt-1 text-sm font-semibold">{props.payload.work_mix.installs}</div>
        </div>

        <div className="rounded-xl border bg-muted/10 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            TCs
          </div>
          <div className="mt-1 text-sm font-semibold">{props.payload.work_mix.tcs}</div>
        </div>

        <div className="rounded-xl border bg-muted/10 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            SROs
          </div>
          <div className="mt-1 text-sm font-semibold">{props.payload.work_mix.sros}</div>
        </div>
      </div>

      {sentiment ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border bg-muted/10 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Surveys
            </div>
            <div className="mt-1 text-sm font-semibold">{sentiment.surveys}</div>
          </div>

          <div className="rounded-xl border bg-muted/10 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Promoters
            </div>
            <div className="mt-1 text-sm font-semibold">{sentiment.promoters}</div>
          </div>

          <div className="rounded-xl border bg-muted/10 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Passives
            </div>
            <div className="mt-1 text-sm font-semibold">{sentiment.passives}</div>
          </div>

          <div className="rounded-xl border bg-muted/10 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Detractors
            </div>
            <div className="mt-1 text-sm font-semibold">{sentiment.detractors}</div>
          </div>
        </div>
      ) : null}

      {rates.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {rates.map((rate) => (
            <div
              key={rate.label}
              className="rounded-xl border bg-muted/10 px-3 py-3"
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {rate.label}
              </div>
              <div className="mt-1 text-sm font-semibold">
                {rate.value_display ?? "—"}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export default function BpRollupDrillDrawer(props: {
  open: boolean;
  payload: BpRollupDrillPayload | null;
  kpis: BpViewKpiItem[];
  activeKpi: BpViewKpiItem | null;
  onSelectKpi: (item: BpViewKpiItem) => void;
  onClose: () => void;
  tnpsDensityMode?: TnpsDensityMode;
  onTnpsDensityModeChange?: (value: TnpsDensityMode) => void;
}) {
  const {
    open,
    payload,
    kpis,
    activeKpi,
    onSelectKpi,
    onClose,
    tnpsDensityMode = "all_checkpoints",
    onTnpsDensityModeChange,
  } = props;

  const activeIndex = useMemo(() => {
    if (!activeKpi) return -1;
    return kpis.findIndex((item) => item.kpi_key === activeKpi.kpi_key);
  }, [kpis, activeKpi]);

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex >= 0 && activeIndex < kpis.length - 1;

  function handlePrev() {
    if (!canGoPrev) return;
    onSelectKpi(kpis[activeIndex - 1]);
  }

  function handleNext() {
    if (!canGoNext) return;
    onSelectKpi(kpis[activeIndex + 1]);
  }

  if (!open || !payload || !payload.selected_kpi) return null;

  const kpi = payload.selected_kpi;
  const isTnps = kpi.kpi_key === "tnps" || kpi.kpi_key === "tnps_score";

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/30">
      <div className="h-full w-full max-w-[900px] overflow-y-auto border-l bg-background">
        <div className="sticky top-0 z-10 space-y-3 border-b bg-background px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Roll-up Inspection</div>
              <div className="font-semibold">{payload.scope.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {payload.scope.scope_type.replaceAll("_", " ")} • {payload.scope.range_label}
                {payload.scope.subtitle ? ` • ${payload.scope.subtitle}` : ""}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-3 py-2 text-sm transition hover:bg-muted/40"
            >
              Close
            </button>
          </div>

          <KpiRail
            items={kpis}
            activeKey={activeKpi?.kpi_key ?? null}
            onSelect={onSelectKpi}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </div>

        <div className="space-y-5 px-5 py-5">
          <KpiVerdict kpi={kpi} />
          {isTnps ? <TnpsSentiment kpi={kpi} /> : <KpiMath kpi={kpi} />}
          <KpiTrend kpi={kpi} />
          {isTnps ? (
            <TnpsPeriodDetail
              kpi={kpi}
              densityMode={tnpsDensityMode}
              onDensityModeChange={onTnpsDensityModeChange}
            />
          ) : null}
          {isTnps ? (
            <TnpsContributionAnalysis rows={kpi.tnps_contributors ?? []} />
          ) : (
            <ContributionAnalysis rows={payload.contributors} kpiKey={kpi.kpi_key} />
          )}
          <ScopeContext payload={payload} />
        </div>
      </div>
    </div>
  );
}