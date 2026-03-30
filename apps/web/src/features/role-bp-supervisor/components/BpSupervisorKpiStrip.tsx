"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

export type BpSupervisorKpiItem = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string;
  band_key: string;
  band_label: string;
  support?: string;
};

type Props = {
  items: BpSupervisorKpiItem[];
  title?: string;
  subtitle?: string;
};

function topBarClass(bandKey: string) {
  if (bandKey === "EXCEEDS") return "bg-[var(--to-success)]";
  if (bandKey === "MEETS") return "bg-[var(--to-primary)]";
  if (bandKey === "NEEDS_IMPROVEMENT") return "bg-[var(--to-warning)]";
  if (bandKey === "MISSES") return "bg-[var(--to-danger)]";
  return "bg-[var(--to-border)]";
}

function PrimaryKpiCard({ item }: { item: BpSupervisorKpiItem }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card text-left">
      <div className={`h-1 w-full ${topBarClass(item.band_key)}`} />

      <div className="px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {item.label}
        </div>

        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="text-xl font-semibold leading-none">
            {item.value_display ?? "—"}
          </div>

          <div className="whitespace-nowrap text-[10px] text-muted-foreground">
            {item.band_label}
          </div>
        </div>

        {item.support ? (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {item.support}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SecondaryKpiCard({ item }: { item: BpSupervisorKpiItem }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card text-left">
      <div className={`h-1 w-full ${topBarClass(item.band_key)}`} />

      <div className="px-2.5 py-2">
        <div className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">
          {item.label}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold leading-none">
            {item.value_display ?? "—"}
          </div>

          <div className="whitespace-nowrap text-[9px] text-muted-foreground">
            {item.band_label}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BpSupervisorKpiStrip({
  items,
  title = "Executive KPI Strip",
  subtitle = "Topline KPI read for the active BP Supervisor scope.",
}: Props) {
  const [expanded, setExpanded] = useState(true);

  const { primary, secondary } = useMemo(() => {
    return {
      primary: items.slice(0, 3),
      secondary: items.slice(3),
    };
  }, [items]);

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{subtitle}</div>
        </div>

        {secondary.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
          >
            <span>{expanded ? "Hide extras" : "Show extras"}</span>
            <span className="opacity-70">+{secondary.length}</span>
            <span className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {primary.map((item) => (
          <PrimaryKpiCard key={item.kpi_key} item={item} />
        ))}
      </div>

      {expanded && secondary.length > 0 ? (
        <div className="mt-2 rounded-xl border bg-muted/10 p-2">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Additional KPIs
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
            {secondary.map((item) => (
              <SecondaryKpiCard key={item.kpi_key} item={item} />
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}