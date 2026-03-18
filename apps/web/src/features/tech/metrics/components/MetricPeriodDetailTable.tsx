"use client";

type PeriodDetailRow = {
  key: string;
  cells: Array<string | number | null>;
};

export default function MetricPeriodDetailTable(props: {
  title: string;
  columns: Array<{
    key: string;
    label: string;
    align?: "left" | "right";
    widthClass?: string;
  }>;
  rows: PeriodDetailRow[];
  footer?: PeriodDetailRow | null;
}) {
  const template = props.columns
    .map((c) => c.widthClass ?? "1fr")
    .join(" ");

  return (
    <div className="rounded-2xl border bg-muted/10 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {props.title}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border">
        <div
          className="border-b bg-muted/20 text-xs font-medium text-muted-foreground"
          style={{ display: "grid", gridTemplateColumns: template }}
        >
          {props.columns.map((col) => (
            <div
              key={col.key}
              className={[
                "px-3 py-2",
                col.align === "right" ? "text-right" : "text-left",
              ].join(" ")}
            >
              {col.label}
            </div>
          ))}
        </div>

        {props.rows.map((row) => (
          <div
            key={row.key}
            className="border-b text-xs"
            style={{ display: "grid", gridTemplateColumns: template }}
          >
            {row.cells.map((cell, idx) => {
              const col = props.columns[idx];
              return (
                <div
                  key={`${row.key}-${col.key}`}
                  className={[
                    "px-3 py-2",
                    col.align === "right" ? "text-right" : "text-left",
                  ].join(" ")}
                >
                  {cell ?? "—"}
                </div>
              );
            })}
          </div>
        ))}

        {props.footer ? (
          <div
            className="bg-muted/10 text-xs font-semibold"
            style={{ display: "grid", gridTemplateColumns: template }}
          >
            {props.footer.cells.map((cell, idx) => {
              const col = props.columns[idx];
              return (
                <div
                  key={`footer-${col.key}`}
                  className={[
                    "px-3 py-2",
                    col.align === "right" ? "text-right" : "text-left",
                  ].join(" ")}
                >
                  {cell ?? "—"}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}