"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ScorecardTile } from "@/features/metrics/scorecard/lib/scorecard.types";
import { mapTilesWithPreset } from "@/features/tech/metrics/lib/mapTilesWithPreset";
import FtrSparkline from "./FtrSparkline";

type RangeKey = "FM" | "3FM" | "12FM";
type Tile = ScorecardTile;

type FtrDebug = {
  requested_range: string;
  distinct_fiscal_month_count: number;
  distinct_fiscal_months_found: string[];
  selected_month_count: number;
  selected_final_rows: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
    rows_in_month: number;
    total_ftr_contact_jobs: number | null;
    ftr_fail_jobs: number | null;
  }>;
  trend?: Array<{
    fiscal_end_date: string;
    metric_date: string;
    batch_id: string;
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

function DrawerRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-muted/10 px-3 py-2">
      <div className="text-sm text-muted-foreground">{props.label}</div>
      <div className="text-sm font-semibold">{props.value}</div>
    </div>
  );
}

function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function computePct(jobs: number, fails: number): number | null {
  if (jobs > 0) return 100 * (1 - fails / jobs);
  if (fails > 0) return 0;
  return null;
}

function MetricDrawer(props: {
  tile: Tile | null;
  onClose: () => void;
  ftrDebug: FtrDebug;
}) {
  if (!props.tile) return null;

  const topColor = props.tile.band.paint?.border ?? "var(--to-border)";
  const isFtr = props.tile.kpi_key === "ftr_rate";
  const selectedRows = props.ftrDebug?.selected_final_rows ?? [];

  const totalJobs = selectedRows.reduce(
    (sum, row) => sum + (row.total_ftr_contact_jobs ?? 0),
    0
  );
  const totalFails = selectedRows.reduce(
    (sum, row) => sum + (row.ftr_fail_jobs ?? 0),
    0
  );
  const totalFtr = formatPct(computePct(totalJobs, totalFails));

  const currentRow = selectedRows[0] ?? null;
  const currentFtr = currentRow
    ? formatPct(
        computePct(
          currentRow.total_ftr_contact_jobs ?? 0,
          currentRow.ftr_fail_jobs ?? 0
        )
      )
    : "—";

  const rolling12Ftr = totalFtr;

  return (
    <>
      <button
        type="button"
        aria-label="Close drawer"
        onClick={props.onClose}
        className="fixed inset-0 z-40 bg-black/35"
      />

      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl border bg-card shadow-2xl">
          <div
            className="sticky top-0 z-10 border-b bg-card p-4"
            style={{ borderTop: `4px solid ${topColor}` }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {props.tile.label}
                </div>
                <div className="mt-1 text-2xl font-semibold leading-none text-foreground">
                  {props.tile.value_display ?? "—"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {props.tile.band.label}
                </div>
              </div>

              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl border px-3 py-2 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-2">
              <DrawerRow label="Current FM" value={currentFtr} />
              <DrawerRow label="Last 3 FM" value={totalFtr} />
              <DrawerRow label="Last 12 FM" value={rolling12Ftr} />
            </div>

            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Chart</div>
              {isFtr ? (
                <FtrSparkline
                  values={(props.ftrDebug?.trend ?? []).map((t) => ({
                    kpi_value: t.kpi_value,
                    is_month_final: t.is_month_final,
                    band_color:
                      t.kpi_value != null && t.kpi_value >= 95
                        ? "#22c55e"
                        : t.kpi_value != null && t.kpi_value >= 90
                          ? "#eab308"
                          : "#ef4444",
                  }))}
                />
              ) : (
                <div className="mt-3 flex h-28 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  Trend chart placeholder
                </div>
              )}
            </div>

            {isFtr ? (
              <div className="rounded-2xl border bg-muted/10 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Period Detail
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border">
                  <div className="grid grid-cols-[1fr_90px_90px_90px] border-b bg-muted/20 text-xs font-medium text-muted-foreground">
                    <div className="px-3 py-2">Metric Date</div>
                    <div className="px-3 py-2 text-right">FTR %</div>
                    <div className="px-3 py-2 text-right">Jobs</div>
                    <div className="px-3 py-2 text-right">Fails</div>
                  </div>

                  {selectedRows.map((row) => {
                    const rowPct = formatPct(
                      computePct(row.total_ftr_contact_jobs ?? 0, row.ftr_fail_jobs ?? 0)
                    );

                    return (
                      <div
                        key={`${row.fiscal_end_date}-${row.metric_date}-${row.batch_id}`}
                        className="grid grid-cols-[1fr_90px_90px_90px] border-b text-xs"
                      >
                        <div className="px-3 py-2">{row.metric_date}</div>
                        <div className="px-3 py-2 text-right">{rowPct}</div>
                        <div className="px-3 py-2 text-right">
                          {row.total_ftr_contact_jobs ?? "—"}
                        </div>
                        <div className="px-3 py-2 text-right">
                          {row.ftr_fail_jobs ?? "—"}
                        </div>
                      </div>
                    );
                  })}

                  <div className="grid grid-cols-[1fr_90px_90px_90px] bg-muted/10 text-xs font-semibold">
                    <div className="px-3 py-2">TOTAL</div>
                    <div className="px-3 py-2 text-right">{totalFtr}</div>
                    <div className="px-3 py-2 text-right">{totalJobs || "—"}</div>
                    <div className="px-3 py-2 text-right">{totalFails || "—"}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

export default function TechMetricsClient(props: {
  initialRange: RangeKey;
  tiles: Tile[];
  activePresetKey: string | null;
  ftrDebug: FtrDebug;
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

      <MetricDrawer
        tile={openTile}
        onClose={() => setOpenMetricKey(null)}
        ftrDebug={props.ftrDebug}
      />
    </>
  );
}