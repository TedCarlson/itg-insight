"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ScorecardTile } from "@/features/metrics/scorecard/lib/scorecard.types";
import { mapTilesWithPreset } from "@/features/tech/metrics/lib/mapTilesWithPreset";
import MetricInspectorDrawer from "./MetricInspectorDrawer";
import TnpsInspectorDrawer from "./TnpsInspectorDrawer";
import { buildFtrDrawerModel, type FtrDebug } from "@/features/tech/metrics/lib/buildFtrDrawerModel";
import {
  buildToolUsageDrawerModel,
  type ToolUsageDebug,
} from "@/features/tech/metrics/lib/buildToolUsageDrawerModel";

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
};

type TnpsTileContext = {
  sample_short?: number | null; // surveys
  sample_long?: number | null; // promoters
  detractors?: number | null;
  meets_min_volume?: boolean | null;
} | null;

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
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-xs font-medium transition active:scale-[0.98]",
        props.active
          ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)]"
          : "bg-muted/20 text-muted-foreground",
        props.pending ? "opacity-90" : "",
      ].join(" ")}
    >
      {props.pending ? <InlineSpinner /> : null}
      <span>{props.label}</span>
    </button>
  );
}

function isTnpsKey(kpiKey: string) {
  return kpiKey.toLowerCase().includes("tnps");
}

function isToolUsageKey(kpiKey: string) {
  const k = kpiKey.toLowerCase();
  return k.includes("tool_usage") || k.includes("toolusage") || k.includes("tu_rate");
}

function formatTnpsSupportLine(tile: Tile): string | null {
  const ctx = tile.context as TnpsTileContext;
  const surveys = ctx?.sample_short ?? 0;
  const promoters = ctx?.sample_long ?? 0;
  const detractors = ctx?.detractors ?? 0;

  if (!surveys || surveys <= 0) return null;

  const passive = Math.max(0, surveys - promoters - detractors);
  const parts: string[] = [];

  if (promoters > 0) parts.push(`${promoters} Promotors`);
  if (passive > 0) parts.push(`${passive} Passives`);
  if (detractors > 0) parts.push(`${detractors} Detractors`);

  return parts.length ? parts.join(" • ") : null;
}

function formatSupportLine(tile: Tile): string | null {
  if (tile.kpi_key === "ftr_rate") {
    const jobs = tile.context?.sample_short;
    const fails = tile.context?.sample_long;

    const left = jobs ? `${Math.round(jobs)} FTR jobs` : null;
    const right = fails ? `${Math.round(fails)} fails` : null;

    return [left, right].filter(Boolean).join(" • ") || null;
  }

  if (isToolUsageKey(tile.kpi_key)) {
    const eligible = tile.context?.sample_short;
    const compliant = tile.context?.sample_long;

    const left = eligible ? `${Math.round(eligible)} eligible` : null;
    const right = compliant ? `${Math.round(compliant)} compliant` : null;

    return [left, right].filter(Boolean).join(" • ") || null;
  }

  if (isTnpsKey(tile.kpi_key)) {
    return formatTnpsSupportLine(tile);
  }

  return null;
}

function MetricCard(props: { tile: Tile; onOpen: () => void }) {
  const supportLine = formatSupportLine(props.tile);
  const borderColor = props.tile.band.paint?.border ?? "var(--to-border)";
  const topBarColor = props.tile.band.paint?.border ?? "var(--to-border)";

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="w-full overflow-hidden rounded-2xl border bg-card text-left active:scale-[0.99]"
      style={{ borderColor }}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: topBarColor }} />

      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {props.tile.label}
        </div>

        <div className="mt-1 text-xl font-semibold leading-none">
          {props.tile.value_display ?? "—"}
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          {props.tile.band.label}
        </div>

        {supportLine ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {supportLine}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export default function TechMetricsClient(props: {
  initialRange: RangeKey;
  tiles: Tile[];
  activePresetKey: string | null;
  ftrDebug: FtrDebug;
  tnpsDebug?: TnpsDebug;
  toolUsageDebug?: ToolUsageDebug;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingRange, setPendingRange] = useState<RangeKey | null>(null);

  const urlRangeRaw = String(searchParams.get("range") ?? props.initialRange ?? "FM").toUpperCase();

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
    if (!openTile || openTile.kpi_key !== "ftr_rate") return null;

    return buildFtrDrawerModel({
      tile: openTile,
      ftrDebug: props.ftrDebug,
      activeRange: activeRangeFromUrl,
    });
  }, [openTile, props.ftrDebug, activeRangeFromUrl]);

  const toolUsageDrawerModel = useMemo(() => {
    if (!openTile || !isToolUsageKey(openTile.kpi_key)) return null;

    return buildToolUsageDrawerModel({
      tile: openTile,
      toolUsageDebug: props.toolUsageDebug ?? null,
      activeRange: activeRangeFromUrl,
    });
  }, [openTile, props.toolUsageDebug, activeRangeFromUrl]);

  const isFtrOpen = openTile?.kpi_key === "ftr_rate";
  const isTnpsOpen = !!openTile && isTnpsKey(openTile.kpi_key);
  const isToolUsageOpen = !!openTile && isToolUsageKey(openTile.kpi_key);

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

      <section className={`space-y-3 ${isPending ? "opacity-85" : ""}`}>
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
        title={openTile?.label ?? ""}
        valueDisplay={openTile?.value_display ?? null}
        bandLabel={openTile?.band.label ?? ""}
        accentColor={openTile?.band.paint?.border}
        onClose={() => setOpenMetricKey(null)}
        summaryRows={ftrDrawerModel?.summaryRows ?? []}
        chart={ftrDrawerModel?.chart ?? null}
        periodDetail={ftrDrawerModel?.periodDetail ?? null}
      />

      <MetricInspectorDrawer
        open={!!openTile && isToolUsageOpen}
        title={openTile?.label ?? ""}
        valueDisplay={openTile?.value_display ?? null}
        bandLabel={openTile?.band.label ?? ""}
        accentColor={openTile?.band.paint?.border}
        onClose={() => setOpenMetricKey(null)}
        summaryRows={toolUsageDrawerModel?.summaryRows ?? []}
        chart={toolUsageDrawerModel?.chart ?? null}
        periodDetail={toolUsageDrawerModel?.periodDetail ?? null}
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