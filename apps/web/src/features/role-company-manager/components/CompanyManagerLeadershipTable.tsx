"use client";

import { Card } from "@/components/ui/Card";

import type { CompanyManagerLeadershipRow } from "../lib/companyManagerView.types";

type Props = {
  rows: CompanyManagerLeadershipRow[];
};

export default function CompanyManagerLeadershipTable({ rows }: Props) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between rounded-2xl border bg-[color-mix(in_oklab,var(--to-primary)_8%,white)] px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
            Leadership Performance
          </div>
          <div className="text-xs text-muted-foreground">
            Rollup of workforce activity and risk by leader grouping.
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b bg-[color-mix(in_oklab,var(--to-primary)_4%,white)]">
              <th className="px-4 py-3 text-left text-[11px] font-medium text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
                Leader
              </th>
              <th className="px-3 py-3 text-right text-[11px] font-medium text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
                Teams
              </th>
              <th className="px-3 py-3 text-right text-[11px] font-medium text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
                Techs
              </th>
              <th className="px-3 py-3 text-right text-[11px] font-medium text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
                Jobs
              </th>
              <th className="px-3 py-3 text-right text-[11px] font-medium text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
                Risk
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No leadership rows available.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.leader_name}
                  className={[
                    "border-b last:border-b-0",
                    index % 2 === 1 ? "bg-muted/10" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="font-medium">{row.leader_name}</div>
                  </td>
                  <td className="px-3 py-3 text-right text-sm align-middle">
                    {row.team_count}
                  </td>
                  <td className="px-3 py-3 text-right text-sm align-middle">
                    {row.tech_count}
                  </td>
                  <td className="px-3 py-3 text-right text-sm align-middle">
                    {row.total_jobs}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium align-middle">
                    {row.risk_count}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}