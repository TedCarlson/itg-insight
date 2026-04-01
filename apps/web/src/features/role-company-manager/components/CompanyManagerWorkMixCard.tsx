"use client";

import type { WorkMixSummary } from "@/shared/kpis/engine/buildWorkMixSummary";

type Props = {
  work_mix: WorkMixSummary;
};

function formatPct(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return "—";
  }
  return `${((100 * part) / total).toFixed(1)}%`;
}

export default function CompanyManagerWorkMixCard({ work_mix }: Props) {
  const total = work_mix.total ?? 0;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Work Mix
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total Jobs
          </div>
          <div className="mt-1 text-2xl font-semibold">{total}</div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Installs
          </div>
          <div className="mt-1 text-lg font-semibold">
            {work_mix.installs}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              · {formatPct(work_mix.installs, total)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            TCs
          </div>
          <div className="mt-1 text-lg font-semibold">
            {work_mix.tcs}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              · {formatPct(work_mix.tcs, total)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            SROs
          </div>
          <div className="mt-1 text-lg font-semibold">
            {work_mix.sros}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              · {formatPct(work_mix.sros, total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}