"use client";

import type { BpWorkMix } from "../lib/bpView.types";

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function MixStat(props: {
  label: string;
  value: number;
  pct: number | null;
}) {
  return (
    <div className="rounded-2xl border bg-muted/10 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-1 text-lg font-semibold leading-none">
        {props.value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {formatPct(props.pct)}
      </div>
    </div>
  );
}

export default function BpWorkMixCard(props: {
  workMix: BpWorkMix;
}) {
  const { workMix } = props;

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Work Mix</div>
          <div className="text-xs text-muted-foreground">
            Range-scoped production mix
          </div>
        </div>

        <div className="rounded-2xl border bg-muted/10 px-4 py-3 text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total
          </div>
          <div className="mt-1 text-xl font-semibold leading-none">
            {workMix.total}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MixStat
          label="Installs"
          value={workMix.installs}
          pct={workMix.install_pct}
        />
        <MixStat
          label="TCs"
          value={workMix.tcs}
          pct={workMix.tc_pct}
        />
        <MixStat
          label="SROs"
          value={workMix.sros}
          pct={workMix.sro_pct}
        />
      </div>
    </section>
  );
}