"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";

type WorkforceCompositionRow = {
  pc_org_id: string;
  org_label: string;

  active_people: number;

  bp_owner_count: number;
  bp_supervisor_count: number;
  tech_count: number;
  other_count: number;
};

type Props = {
  rows: WorkforceCompositionRow[];
};

function totalLeadership(
  row: WorkforceCompositionRow,
) {
  return (
    row.bp_owner_count +
    row.bp_supervisor_count
  );
}

export function BpOwnerMarketComparisonCard({
  rows,
}: Props) {
  const totalTechs = rows.reduce(
    (sum, row) => sum + row.tech_count,
    0,
  );

  const totalLeadershipCount =
    rows.reduce(
      (sum, row) =>
        sum + totalLeadership(row),
      0,
    );

  const totalWorkforce = rows.reduce(
    (sum, row) =>
      sum + row.active_people,
    0,
  );

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            Cross-Market Workforce Scan
          </div>

          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Operational staffing visibility
            across covered contractor
            markets using existing workforce
            reporting contracts.
          </p>
        </div>

        <Link
          href="/bp-owner/workforce"
          prefetch={false}
          className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Open Workforce
        </Link>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-background/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workforce
          </div>

          <div className="mt-2 text-3xl font-bold tabular-nums">
            {totalWorkforce}
          </div>

          <div className="mt-1 text-sm text-muted-foreground">
            Active contractor workforce
          </div>
        </div>

        <div className="rounded-xl border bg-background/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Technicians
          </div>

          <div className="mt-2 text-3xl font-bold tabular-nums">
            {totalTechs}
          </div>

          <div className="mt-1 text-sm text-muted-foreground">
            Field technician population
          </div>
        </div>

        <div className="rounded-xl border bg-background/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Leadership
          </div>

          <div className="mt-2 text-3xl font-bold tabular-nums">
            {totalLeadershipCount}
          </div>

          <div className="mt-1 text-sm text-muted-foreground">
            Owners, supervisors, and leads
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">
                Market
              </th>

              <th className="px-4 py-3 text-right font-semibold">
                Workforce
              </th>

              <th className="px-4 py-3 text-right font-semibold">
                Leadership
              </th>

              <th className="px-4 py-3 text-right font-semibold">
                Techs
              </th>

              <th className="px-4 py-3 text-right font-semibold">
                Other
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.pc_org_id}
                  className="border-t"
                >
                  <td className="px-4 py-3 font-medium">
                    {row.org_label}
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.active_people}
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums">
                    {totalLeadership(row)}
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.tech_count}
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.other_count}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No contractor workforce data
                  available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default BpOwnerMarketComparisonCard;