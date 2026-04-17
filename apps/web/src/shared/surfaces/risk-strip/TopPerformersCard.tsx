// path: apps/web/src/shared/surfaces/risk-strip/TopPerformersCard.tsx

"use client";

type Row = {
  name: string;
  value: number;
};

function podiumTone(rank: number) {
  if (rank === 0) {
    return {
      row: "border-amber-300 bg-amber-50/70 text-amber-800",
      badge: "bg-amber-500 text-white",
    };
  }
  if (rank === 1) {
    return {
      row: "border-zinc-300 bg-zinc-50/80 text-zinc-700",
      badge: "bg-zinc-500 text-white",
    };
  }
  return {
    row: "border-amber-400/70 bg-amber-50/45 text-amber-900",
    badge: "bg-amber-700 text-white",
  };
}

export default function TopPerformersCard(props: { rows: Row[] }) {
  const rows = props.rows.slice(0, 5);

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Leaderboard
      </div>

      <div className="mt-2 space-y-1.5">
        {rows.map((r, i) => {
          const isTop3 = i < 3;

          if (isTop3) {
            const tone = podiumTone(i);

            return (
              <div
                key={`${r.name}-${i}`}
                className={[
                  "flex items-center justify-between rounded-md border px-2 py-1.5 text-sm",
                  tone.row,
                ].join(" ")}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                      tone.badge,
                    ].join(" ")}
                  >
                    #{i + 1}
                  </span>
                  <span className="truncate">{r.name}</span>
                </div>

                <div className="tabular-nums text-sm font-semibold">
                  {r.value.toFixed(1)}
                </div>
              </div>
            );
          }

          return (
            <div
              key={`${r.name}-${i}`}
              className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/35 px-2 py-1.5 text-sm"
            >
              <span className="truncate text-foreground/90">{r.name}</span>
              <span className="tabular-nums font-medium text-foreground/90">
                {r.value.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}