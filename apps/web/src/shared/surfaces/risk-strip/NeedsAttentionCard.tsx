// path: apps/web/src/shared/surfaces/risk-strip/NeedsAttentionCard.tsx

"use client";

type Row = {
  name: string;
  value: number;
};

function urgencyTone(index: number) {
  if (index === 0) {
    return "border-rose-300 bg-rose-100/85 text-rose-800";
  }
  if (index === 1) {
    return "border-rose-300 bg-rose-100/65 text-rose-800";
  }
  if (index === 2) {
    return "border-rose-200 bg-rose-50/75 text-rose-700";
  }
  if (index === 3) {
    return "border-rose-200 bg-rose-50/50 text-rose-700";
  }
  return "border-rose-200 bg-rose-50/28 text-foreground/85";
}

export default function NeedsAttentionCard(props: { rows: Row[] }) {
  const rows = props.rows.slice(0, 5);

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Coaching Queue
      </div>

      <div className="mt-2 space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={`${r.name}-${i}`}
            className={[
              "flex items-center justify-between rounded-md border px-2 py-1.5 text-sm transition",
              urgencyTone(i),
            ].join(" ")}
          >
            <span className="truncate">{r.name}</span>

            <span className="tabular-nums text-sm font-medium">
              {r.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}