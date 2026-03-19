import type {
  BpViewRosterMetricCell,
  BpViewRosterRow,
} from "../lib/bpView.types";

function bandPillClass(bandKey: string) {
  if (bandKey === "EXCEEDS") return "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]";
  if (bandKey === "MEETS") return "border-[var(--to-primary)] bg-[color-mix(in_oklab,var(--to-primary)_10%,white)]";
  if (bandKey === "NEEDS_IMPROVEMENT") return "border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_10%,white)]";
  if (bandKey === "MISSES") return "border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_10%,white)]";
  return "border-[var(--to-border)] bg-muted/10";
}

function MobileMetricCard(props: { metric: BpViewRosterMetricCell }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${bandPillClass(props.metric.band_key)}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.metric.label}
      </div>
      <div className="mt-1 text-sm font-semibold">
        {props.metric.value_display ?? "—"}
      </div>
    </div>
  );
}

function MobileRowCard(props: { row: BpViewRosterRow }) {
  return (
    <button
      type="button"
      className="w-full rounded-2xl border bg-card p-4 text-left active:scale-[0.99]"
    >
      <div className="text-sm font-semibold">{props.row.full_name}</div>
      <div className="mt-1 text-xs text-muted-foreground">{props.row.context}</div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {props.row.metrics.map((metric) => (
          <MobileMetricCard key={metric.kpi_key} metric={metric} />
        ))}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Below target count: {props.row.below_target_count}
      </div>
    </button>
  );
}

function DesktopHeaderCell(props: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div
      className={[
        "px-3 py-2 text-xs font-medium text-muted-foreground",
        props.align === "right" ? "text-right" : "text-left",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function DesktopCell(props: {
  children: React.ReactNode;
  align?: "left" | "right";
  strong?: boolean;
}) {
  return (
    <div
      className={[
        "px-3 py-3 text-sm",
        props.align === "right" ? "text-right" : "text-left",
        props.strong ? "font-semibold" : "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

export default function BpViewRosterSurface(props: {
  columns: Array<{ kpi_key: string; label: string }>;
  rows: BpViewRosterRow[];
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Team Work Surface
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          Mobile cards • tablet/desktop table
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {props.rows.map((row) => (
          <MobileRowCard key={row.person_id} row={row} />
        ))}
      </div>

      <div className="hidden md:block">
        <div className="overflow-auto rounded-2xl border">
          <div
            className="grid min-w-[1100px] border-b bg-muted/10"
            style={{
              gridTemplateColumns: `260px repeat(${props.columns.length}, minmax(110px, 1fr)) 120px`,
            }}
          >
            <DesktopHeaderCell>Tech</DesktopHeaderCell>
            {props.columns.map((col) => (
              <DesktopHeaderCell key={col.kpi_key} align="right">
                {col.label}
              </DesktopHeaderCell>
            ))}
            <DesktopHeaderCell align="right">Risk</DesktopHeaderCell>
          </div>

          {props.rows.map((row) => (
            <button
              key={row.person_id}
              type="button"
              className="grid w-full min-w-[1100px] border-b text-left hover:bg-muted/10"
              style={{
                gridTemplateColumns: `260px repeat(${props.columns.length}, minmax(110px, 1fr)) 120px`,
              }}
            >
              <DesktopCell strong>
                <div>{row.full_name}</div>
                <div className="mt-1 text-xs font-normal text-muted-foreground">
                  {row.context}
                </div>
              </DesktopCell>

              {props.columns.map((col) => {
                const metric = row.metrics.find((m) => m.kpi_key === col.kpi_key);
                return (
                  <DesktopCell key={col.kpi_key} align="right">
                    {metric?.value_display ?? "—"}
                  </DesktopCell>
                );
              })}

              <DesktopCell align="right">{row.below_target_count}</DesktopCell>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}