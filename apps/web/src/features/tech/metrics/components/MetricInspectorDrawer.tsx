"use client";

import type { ReactNode } from "react";

function DrawerRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-muted/10 px-3 py-2">
      <div className="text-sm text-muted-foreground">{props.label}</div>
      <div className="text-sm font-semibold">{props.value}</div>
    </div>
  );
}

export default function MetricInspectorDrawer(props: {
  open: boolean;
  title: string;
  valueDisplay: string | null;
  bandLabel: string;
  accentColor: string | null | undefined;
  onClose: () => void;
  summaryRows: Array<{ label: string; value: string }>;
  chart: ReactNode;
  periodDetail?: ReactNode;
}) {
  if (!props.open) return null;

  const topColor = props.accentColor ?? "var(--to-border)";

  return (
    <>
      <button
        type="button"
        aria-label="Close drawer"
        onClick={props.onClose}
        className="fixed inset-0 z-40 bg-black/35"
      />

      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl border bg-card shadow-2xl">
          <div
            className="sticky top-0 z-10 border-b bg-card p-4"
            style={{ borderTop: `4px solid ${topColor}` }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {props.title}
                </div>
                <div className="mt-1 text-2xl font-semibold leading-none text-foreground">
                  {props.valueDisplay ?? "—"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {props.bandLabel}
                </div>
              </div>

              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl border px-3 py-2 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-2">
              {props.summaryRows.map((row) => (
                <DrawerRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                />
              ))}
            </div>

            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Chart
              </div>
              {props.chart}
            </div>

            {props.periodDetail ?? null}
          </div>
        </div>
      </div>
    </>
  );
}