"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BpRangeKey, BpViewHeaderData } from "../lib/bpView.types";

function normalizeRange(value: string | null | undefined): BpRangeKey {
  const upper = String(value ?? "FM").toUpperCase();
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

function InlineSpinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function RangeChip(props: {
  label: string;
  active?: boolean;
  pending?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.pending}
      className={[
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition active:scale-[0.98]",
        props.active
          ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] text-foreground"
          : "bg-background text-muted-foreground hover:bg-muted/30",
        props.pending ? "opacity-90" : "",
      ].join(" ")}
    >
      {props.pending ? <InlineSpinner /> : null}
      <span>{props.label}</span>
    </button>
  );
}

function ScopeChip(props: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "rounded-xl border px-3 py-2 text-xs font-medium transition",
        props.active
          ? "border-[var(--to-primary)] bg-[color-mix(in_oklab,var(--to-primary)_10%,white)] text-foreground"
          : "bg-background text-muted-foreground hover:bg-muted/30",
      ].join(" ")}
    >
      {props.label}
    </button>
  );
}

function InfoPill(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-muted/10 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-1 text-sm font-semibold">{props.value}</div>
    </div>
  );
}

export default function BpViewHeader(props: {
  header: BpViewHeaderData;
}) {
  const { header } = props;

  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingRange, setPendingRange] = useState<BpRangeKey | null>(null);

  const activeRangeFromUrl = normalizeRange(searchParams.get("range"));
  const optimisticRange =
    isPending && pendingRange ? pendingRange : activeRangeFromUrl;

  function setRange(next: BpRangeKey) {
    if (next === activeRangeFromUrl) return;

    setPendingRange(next);

    startTransition(() => {
      const qs = new URLSearchParams(searchParams.toString());

      if (next === "FM") {
        qs.delete("range");
      } else {
        qs.set("range", next);
      }

      const href = qs.toString() ? `/bp/view?${qs.toString()}` : "/bp/view";
      router.push(href);
      router.refresh();
    });
  }

  const subtitleParts = [header.role_label, header.rep_full_name].filter(Boolean);

  return (
    <section
      className={[
        "rounded-2xl border bg-card p-4 transition",
        isPending ? "opacity-90" : "",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1">
          <div className="text-xl font-semibold">BP View</div>
          <div className="text-sm text-muted-foreground">
            {subtitleParts.join(" • ")}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-3">
          <InfoPill label="Contractor" value={header.contractor_name ?? "—"} />
          <InfoPill label="Headcount" value={String(header.headcount)} />
          <InfoPill label="As Of" value={header.as_of_date} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Org Scope
          </div>
          <div className="flex flex-wrap gap-2">
            <ScopeChip label={header.org_label} active />
            <ScopeChip label={`Org Count: ${header.org_count}`} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Range
          </div>
          <div className="flex flex-wrap gap-2">
            <RangeChip
              label="Current"
              active={optimisticRange === "FM"}
              pending={isPending && pendingRange === "FM"}
              onClick={() => setRange("FM")}
            />
            <RangeChip
              label="3 FM"
              active={optimisticRange === "3FM"}
              pending={isPending && pendingRange === "3FM"}
              onClick={() => setRange("3FM")}
            />
            <RangeChip
              label="12 FM"
              active={optimisticRange === "12FM"}
              pending={isPending && pendingRange === "12FM"}
              onClick={() => setRange("12FM")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}