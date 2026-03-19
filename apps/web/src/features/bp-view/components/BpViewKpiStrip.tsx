import type { BpViewKpiItem } from "../lib/bpView.types";

function topBarClass(bandKey: string) {
  if (bandKey === "EXCEEDS") return "bg-[var(--to-success)]";
  if (bandKey === "MEETS") return "bg-[var(--to-primary)]";
  if (bandKey === "NEEDS_IMPROVEMENT") return "bg-[var(--to-warning)]";
  if (bandKey === "MISSES") return "bg-[var(--to-danger)]";
  return "bg-[var(--to-border)]";
}

function KpiCard(props: { item: BpViewKpiItem }) {
  const { item } = props;

  return (
    <button
      type="button"
      className="w-full overflow-hidden rounded-2xl border bg-card text-left active:scale-[0.99]"
    >
      <div className={`h-1.5 w-full ${topBarClass(item.band_key)}`} />
      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {item.label}
        </div>
        <div className="mt-1 text-xl font-semibold leading-none">
          {item.value_display ?? "—"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{item.band_label}</div>
        {item.support ? (
          <div className="mt-1 text-xs text-muted-foreground">{item.support}</div>
        ) : null}
      </div>
    </button>
  );
}

export default function BpViewKpiStrip(props: {
  items: BpViewKpiItem[];
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Executive KPI Strip
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        {props.items.map((item) => (
          <KpiCard key={item.kpi_key} item={item} />
        ))}
      </div>
    </section>
  );
}