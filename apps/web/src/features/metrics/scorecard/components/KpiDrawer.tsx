// RUN THIS
// Replace the entire file:
// apps/web/src/features/metrics/scorecard/components/KpiDrawer.tsx

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { ScorecardTile } from "../lib/scorecard.types";
import BandChip from "./BandChip";
import MomentumGlyph from "./MomentumGlyph";
import KpiTrendChart from "./KpiTrendChart";
import KpiStatsGrid from "./KpiStatsGrid";

export type FiscalWindow = "FM" | "3FM" | "12FM";

const WINDOW_META: Record<FiscalWindow, { label: string }> = {
  FM: { label: "This FM" },
  "3FM": { label: "3 FM" },
  "12FM": { label: "12 FM" },
};

export default function KpiDrawer(props: { tile: ScorecardTile | null; onClose: () => void }) {
  const { tile, onClose } = props;
  const [windowKey, setWindowKey] = useState<FiscalWindow>("FM");

  useEffect(() => {
    if (!tile) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tile, onClose]);

  if (!tile) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 p-2 sm:p-3 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${tile.label} details`}
    >
      <div className="flex h-full w-full items-end justify-center md:items-center">
        <Card
          className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border p-0 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
              <div className="min-w-0">
                <div className="text-base font-semibold">{tile.label}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <BandChip label={tile.band.label} />
                  <MomentumGlyph momentum={tile.momentum} />
                </div>
              </div>

              <button
                type="button"
                className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            <div className="px-4 pb-4 sm:px-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Window
              </div>

              <div className="mt-2 inline-flex rounded-full border bg-background p-1">
                {(Object.keys(WINDOW_META) as FiscalWindow[]).map((key) => {
                  const active = key === windowKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={[
                        "rounded-full px-3 py-1.5 text-sm font-medium transition",
                        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
                      ].join(" ")}
                      onClick={() => setWindowKey(key)}
                    >
                      {WINDOW_META[key].label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="grid gap-4">
              <KpiTrendChart
                kpiKey={tile.kpi_key}
                fiscalWindow={windowKey}
                paint={tile.band.paint}
              />

              <KpiStatsGrid tile={tile} fiscalWindow={windowKey} />
            </div>
          </div>

          <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="text-xs text-muted-foreground">
                {tile.label} • {WINDOW_META[windowKey].label}
              </div>

              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}