"use client";

import { useState } from "react";
import type { BpViewKpiItem } from "../lib/bpView.types";

function topBarClass(bandKey: string) {
  if (bandKey === "EXCEEDS") return "bg-[var(--to-success)]";
  if (bandKey === "MEETS") return "bg-[var(--to-primary)]";
  if (bandKey === "NEEDS_IMPROVEMENT") return "bg-[var(--to-warning)]";
  if (bandKey === "MISSES") return "bg-[var(--to-danger)]";
  return "bg-[var(--to-border)]";
}

function clickableCardClass(clickable?: boolean, active?: boolean) {
  if (!clickable) return "";
  return [
    "cursor-pointer transition",
    "hover:shadow-sm hover:ring-1 hover:ring-[var(--to-accent)]",
    active ? "ring-2 ring-[var(--to-accent)]" : "",
  ].join(" ");
}

function PrimaryKpiCard(props: {
  item: BpViewKpiItem;
  clickable?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const { item, clickable, active, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={[
        "overflow-hidden rounded-xl border bg-card text-left",
        clickableCardClass(clickable, active),
      ].join(" ")}
    >
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
    </button>
  );
}

function SecondaryKpiCard(props: {
  item: BpViewKpiItem;
  clickable?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const { item, clickable, active, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={[
        "overflow-hidden rounded-lg border bg-card text-left",
        clickableCardClass(clickable, active),
      ].join(" ")}
    >
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
    </button>
  );
}

export default function BpViewKpiStrip(props: {
  items: BpViewKpiItem[];
  selectedKpiKey?: string | null;
  onSelectItem?: (item: BpViewKpiItem) => void;
}) {
  const { items, selectedKpiKey = null, onSelectItem } = props;
  const [expanded, setExpanded] = useState(false);

  const primary = items.slice(0, 3);
  const secondary = items.slice(3);
  const clickable = typeof onSelectItem === "function";

  return (
    <section className="rounded-2xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Executive KPI Strip
          </div>
          {clickable ? (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Tap a KPI to inspect the roll-up
            </div>
          ) : null}
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
          <PrimaryKpiCard
            key={item.kpi_key}
            item={item}
            clickable={clickable}
            active={selectedKpiKey === item.kpi_key}
            onClick={() => onSelectItem?.(item)}
          />
        ))}
      </div>

      {expanded && secondary.length > 0 ? (
        <div className="mt-2 rounded-xl border bg-muted/10 p-2">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Additional KPIs
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
            {secondary.map((item) => (
              <SecondaryKpiCard
                key={item.kpi_key}
                item={item}
                clickable={clickable}
                active={selectedKpiKey === item.kpi_key}
                onClick={() => onSelectItem?.(item)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}