import type { BpViewHeaderData } from "../lib/bpView.types";

function RangeChip(props: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "rounded-xl border px-3 py-2 text-xs font-medium transition",
        props.active
          ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] text-foreground"
          : "bg-background text-muted-foreground hover:bg-muted/30",
      ].join(" ")}
    >
      {props.label}
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

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1">
          <div className="text-xl font-semibold">BP View</div>
          <div className="text-sm text-muted-foreground">
            {header.role_label} • {header.scope_label}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InfoPill label="Resolved Scope" value={header.org_label} />
          <InfoPill label="Role" value={header.role_label} />
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
            <RangeChip label="FM" active={header.range_label === "FM"} />
            <RangeChip label="3FM" active={header.range_label === "3FM"} />
            <RangeChip label="12FM" active={header.range_label === "12FM"} />
          </div>
        </div>
      </div>
    </section>
  );
}