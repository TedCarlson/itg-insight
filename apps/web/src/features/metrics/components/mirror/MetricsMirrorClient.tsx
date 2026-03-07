"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";

type MirrorRow = {
  person_id: string;
  full_name: string;
  tech_id: string | null;
  email: string | null;
  position_title: string | null;
};

function matches(row: MirrorRow, q: string) {
  if (!q) return true;
  const hay = [
    row.full_name,
    row.tech_id ?? "",
    row.email ?? "",
    row.position_title ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}

export default function MetricsMirrorClient(props: { rows: MirrorRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.rows.filter((row) => matches(row, q));
  }, [props.rows, query]);

  return (
    <Card className="rounded-2xl border p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-medium">Open a technician mirror</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Search by name, tech ID, email, or position.
          </div>
        </div>

        <div className="w-full md:w-[360px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tech..."
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none ring-0 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tech ID</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Position</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Mirror</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length > 0 ? (
              filtered.map((row) => (
                <tr key={row.person_id} className="border-t">
                  <td className="px-3 py-2">{row.full_name}</td>
                  <td className="px-3 py-2 tabular-nums">{row.tech_id ?? "—"}</td>
                  <td className="px-3 py-2">{row.position_title ?? "—"}</td>
                  <td className="px-3 py-2">{row.email ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/metrics/tech-scorecard/${row.person_id}`}
                      className="inline-flex rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      Open Mirror
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No technicians matched your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}