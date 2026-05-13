// path: apps/web/src/features/role-bp-owner/components/BpOwnerRouteDemandCard.tsx

import Link from "next/link";

import { Card } from "@/components/ui/Card";

import type {
  ExecutiveDailyScheduleStatusOrgRow,
  ExecutiveDailyScheduleStatusPayload,
} from "@/shared/server/executive/buildDailyScheduleStatus.server";

type Props = {
  status: ExecutiveDailyScheduleStatusPayload;
};

function pct(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function callOutLabel(value: number | null) {
  return value === null ? "—" : String(value);
}

export default function BpOwnerRouteDemandCard({ status }: Props) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Operations</div>
          <div className="text-sm text-muted-foreground">
            Today&apos;s schedule and shift-validation snapshot for contractor techs.
          </div>
        </div>

        <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Today
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border px-3 py-2.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            HC
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {status.total_hc}
          </div>
        </div>

        <div className="rounded-lg border px-3 py-2.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Scheduled
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {status.total_scheduled}
          </div>
        </div>

        <div className="rounded-lg border px-3 py-2.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            SV
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {status.total_sv}
          </div>
        </div>

        <div className="rounded-lg border px-3 py-2.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Util
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {pct(status.total_util_pct)}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Org</th>
              <th className="px-4 py-3 text-right font-semibold">HC</th>
              <th className="px-4 py-3 text-right font-semibold">Sched</th>
              <th className="px-4 py-3 text-right font-semibold">SV</th>
              <th className="px-4 py-3 text-right font-semibold">Util</th>
              <th className="px-4 py-3 text-right font-semibold">C/O</th>
            </tr>
          </thead>

          <tbody>
            {status.rows_by_org.length ? (
              status.rows_by_org.map(
                (row: ExecutiveDailyScheduleStatusOrgRow) => (
                  <tr key={row.pc_org_id} className="border-t">
                    <td className="px-4 py-3 font-medium">{row.org_label}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.hc}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.scheduled}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.sv}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {pct(row.util_pct)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {callOutLabel(row.call_outs)}
                    </td>
                  </tr>
                ),
              )
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No operations rows available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Link
          href="/bp-owner/tech-history"
          prefetch={false}
          className="inline-flex rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-muted/40"
        >
          Open Tech History
        </Link>
      </div>
    </Card>
  );
}