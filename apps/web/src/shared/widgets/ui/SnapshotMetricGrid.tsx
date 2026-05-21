import type { HomeMetricDatum } from "@/shared/widgets/contracts/widget.types";

function toneClass(tone: HomeMetricDatum["tone"]) {
  if (tone === "good") return "border-emerald-500/40";
  if (tone === "warn") return "border-amber-500/40";
  if (tone === "bad") return "border-rose-500/40";
  return "border-[var(--to-border)]";
}

export function SnapshotMetricGrid(props: {
  title: string;
  items: HomeMetricDatum[];
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{props.title}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {props.items.map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border bg-[var(--to-surface)] p-3 ${toneClass(item.tone)}`}
          >
            <div className="text-[11px] uppercase tracking-wide text-[var(--to-muted)]">
              {item.label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{item.value}</div>
            {item.note ? (
              <div className="mt-2 text-xs text-[var(--to-muted)]">{item.note}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
