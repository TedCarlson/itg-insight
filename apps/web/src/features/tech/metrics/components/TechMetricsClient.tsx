"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ScorecardTile } from "@/features/metrics/scorecard/lib/scorecard.types";
import { mapTilesWithPreset } from "@/features/tech/metrics/lib/mapTilesWithPreset";
import MetricInspectorDrawer from "./MetricInspectorDrawer";
import TnpsInspectorDrawer from "./TnpsInspectorDrawer";
import { buildFtrDrawerModel, type FtrDebug } from "@/features/tech/metrics/lib/buildFtrDrawerModel";

type RangeKey = "FM" | "3FM" | "12FM";
type Tile = ScorecardTile;

type TnpsDebug = {
  requested_range: string;
  distinct_fiscal_month_count: number;
  distinct_fiscal_months_found: string[];
  selected_month_count: number;
  selected_final_rows: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    rows_in_month: number;
    tnps_surveys: number | null;
    tnps_promoters: number | null;
    tnps_detractors: number | null;
  }>;
  trend?: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    tnps_surveys: number | null;
    tnps_promoters: number | null;
    tnps_detractors: number | null;
    kpi_value: number | null;
    is_month_final: boolean;
  }>;
} | null;

function RankCell(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-2 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-1 text-base font-semibold leading-none">{props.value}</div>
    </div>
  );
}

function MixStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-1 text-base font-semibold leading-none">{props.value}</div>
    </div>
  );
}

function MixRow(props: { label: string; count: string; pct: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-muted/10 px-3 py-2">
      <div className="min-w-0 text-sm font-medium">{props.label}</div>
      <div className="ml-3 flex items-center gap-3 text-sm">
        <span className="font-semibold">{props.count}</span>
        <span className="text-muted-foreground">{props.pct}</span>
      </div>
    </div>
  );
}

function InlineSpinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function RangeChip(props: {
  label: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.pending}
      className={[
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-xs font-medium transition active:scale-[0.98] disabled:cursor-default",
        props.active
          ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] text-foreground"
          : "bg-muted/20 text-muted-foreground hover:bg-muted/30",
        props.pending ? "opacity-90" : "",
      ].join(" ")}
    >
      {props.pending ? <InlineSpinner /> : null}
      <span>{props.label}</span>
    </button>
  );
}

function formatSupportLine(tile: Tile): string | null {
  if (tile.kpi_key !== "ftr_rate") return null;

  const jobs = tile.context?.sample_short;
  const fails = tile.context?.sample_long;

  if ((jobs == null || !Number.isFinite(jobs)) && (fails == null || !Number.isFinite(fails))) {
    return null;
  }

  const left = jobs != null && Number.isFinite(jobs) ? `${Math.round(jobs)} FTR jobs` : null;
  const right = fails != null && Number.isFinite(fails) ? `${Math.round(fails)} fails` : null;

  return [left, right].filter(Boolean).join(" • ");
}

function MetricCard(props: { tile: Tile; onOpen: () => void }) {
  const topColor = props.tile.band.paint?.border ?? "var(--to-border)";
  const supportLine = formatSupportLine(props.tile);

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="w-full overflow-hidden rounded-2xl border bg-card text-left transition active:scale-[0.99]"
      style={{ borderColor: topColor }}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: topColor }} />
      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{props.tile.label}</div>
        <div className="mt-1 text-xl font-semibold leading-none text-foreground">
          {props.tile.value_display ?? "—"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{props.tile.band.label}</div>
        {supportLine ? <div className="mt-1 text-xs text-muted-foreground">{supportLine}</div> : null}
      </div>
    </button>
  );
}

function isTnpsKey(kpiKey: string) {
  const k = kpiKey.toLowerCase();
  return k.includes("tnps");
}

export default function TechMetricsClient(props: {
  initialRange: RangeKey;
  tiles: Tile[];
  activePresetKey: string | null;
  ftrDebug: FtrDebug;
  tnpsDebug?: TnpsDebug;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingRange, setPendingRange] = useState<RangeKey | null>(null);

  const urlRangeRaw = String(
    searchParams.get("range") ?? props.initialRange ?? "FM"
  ).toUpperCase();

  const activeRangeFromUrl: RangeKey =
    urlRangeRaw === "3FM" ? "3FM" : urlRangeRaw === "12FM" ? "12FM" : "FM";

  const optimisticRange: RangeKey =
    isPending && pendingRange ? pendingRange : activeRangeFromUrl;

  function onSelectRange(next: RangeKey) {
    if (next === activeRangeFromUrl) return;

    setPendingRange(next);

    startTransition(() => {
      router.push(`/tech/metrics?range=${next}`);
    });
  }

  const tiles = useMemo(
    () => mapTilesWithPreset(props.tiles, props.activePresetKey),
    [props.tiles, props.activePresetKey]
  );

  const [openMetricKey, setOpenMetricKey] = useState<string | null>(null);

  const openTile = useMemo(
    () => tiles.find((t) => t.kpi_key === openMetricKey) ?? null,
    [openMetricKey, tiles]
  );

  const ftrDrawerModel = useMemo(() => {
    if (!openTile) return null;
    if (openTile.kpi_key !== "ftr_rate") return null;

    return buildFtrDrawerModel({
      tile: openTile,
      ftrDebug: props.ftrDebug,
      activeRange: activeRangeFromUrl,
    });
  }, [openTile, props.ftrDebug, activeRangeFromUrl]);

  const isFtrOpen = openTile?.kpi_key === "ftr_rate";
  const isTnpsOpen = !!openTile && isTnpsKey(openTile.kpi_key);

  return (
    <>
      <section className="rounded-2xl border bg-card p-3">
        <div className="grid grid-cols-3 gap-2">
          <RangeChip
            label="Current FM"
            active={optimisticRange === "FM"}
            pending={isPending && pendingRange === "FM"}
            onClick={() => onSelectRange("FM")}
          />
          <RangeChip
            label="Last 3 FM"
            active={optimisticRange === "3FM"}
            pending={isPending && pendingRange === "3FM"}
            onClick={() => onSelectRange("3FM")}
          />
          <RangeChip
            label="Last 12 FM"
            active={optimisticRange === "12FM"}
            pending={isPending && pendingRange === "12FM"}
            onClick={() => onSelectRange("12FM")}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-4 gap-2">
          <RankCell label="Team" value="—" />
          <RankCell label="Region" value="—" />
          <RankCell label="Division" value="—" />
          <RankCell label="National" value="—" />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Work Mix
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border bg-muted/20 p-2">
          <MixStat label="Jobs" value="—" />
          <MixStat label="Jobs/Day" value="—" />
          <MixStat label="Workdays" value="—" />
        </div>

        <div className="mt-3 space-y-2">
          <MixRow label="Install" count="—" pct="—" />
          <MixRow label="Service" count="—" pct="—" />
          <MixRow label="Trouble" count="—" pct="—" />
        </div>
      </section>

      <section className={`space-y-3 transition-opacity ${isPending ? "opacity-85" : "opacity-100"}`}>
        {tiles.map((tile) => (
          <MetricCard
            key={tile.kpi_key}
            tile={tile}
            onOpen={() => setOpenMetricKey(tile.kpi_key)}
          />
        ))}
      </section>

      <MetricInspectorDrawer
        open={!!openTile && isFtrOpen}
        title={openTile?.label ?? "Metric"}
        valueDisplay={openTile?.value_display ?? null}
        bandLabel={openTile?.band.label ?? "—"}
        accentColor={openTile?.band.paint?.border}
        onClose={() => setOpenMetricKey(null)}
        summaryRows={ftrDrawerModel?.summaryRows ?? []}
        chart={
          ftrDrawerModel?.chart ?? (
            <div className="mt-3 flex h-28 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              Trend chart placeholder
            </div>
          )
        }
        periodDetail={ftrDrawerModel?.periodDetail ?? null}
      />

      <TnpsInspectorDrawer
        open={!!openTile && isTnpsOpen}
        tile={openTile}
        onClose={() => setOpenMetricKey(null)}
        activeRange={activeRangeFromUrl}
        tnpsDebug={props.tnpsDebug}
      />
    </>
  );
}