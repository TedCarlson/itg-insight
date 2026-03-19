import type { BpViewRiskItem } from "../lib/bpView.types";

function RiskCard(props: { item: BpViewRiskItem }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {props.item.title}
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none">{props.item.value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{props.item.note}</div>
    </div>
  );
}

export default function BpViewRiskStrip(props: {
  items: BpViewRiskItem[];
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Risk / Action Strip
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {props.items.map((item) => (
          <RiskCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}