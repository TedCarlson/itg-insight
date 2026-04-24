// path: apps/web/src/shared/surfaces/workforce/WorkforceSurfaceClient.tsx

"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import type {
  WorkforceRow,
  WorkforceSeatType,
  WorkforceTabKey,
} from "@/shared/types/workforce/workforce.types";
import type { WorkforceSurfacePayload } from "@/shared/types/workforce/surfacePayload";

type Props = {
  payload: WorkforceSurfacePayload;
  mode?: "manager" | "supervisor" | "admin";
};

function badgeTone(seatType: WorkforceSeatType) {
  if (seatType === "FIELD") return "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]";
  if (seatType === "LEADERSHIP") return "border-[var(--to-primary)] bg-[color-mix(in_oklab,var(--to-primary)_10%,white)]";
  if (seatType === "SUPPORT") return "border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_10%,white)]";
  return "border-[var(--to-info)] bg-[color-mix(in_oklab,var(--to-info)_10%,white)]";
}

function tabLabel(key: WorkforceTabKey) {
  if (key === "ALL") return "All";
  if (key === "FIELD") return "Field";
  if (key === "LEADERSHIP") return "Leadership";
  if (key === "INCOMPLETE") return "Incomplete";
  if (key === "SUPPORT") return "Support";
  return "Travel Techs";
}

function identityLabel(row: WorkforceRow) {
  const lead = row.preferred_name ?? row.first_name ?? row.display_name;
  return row.tech_id ? `${lead} • ${row.tech_id}` : lead;
}

export function WorkforceSurfaceClient({ payload }: Props) {
  const [tab, setTab] = useState<WorkforceTabKey>("FIELD");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WorkforceRow | null>(null);

  const filtered = useMemo(() => {
    let rows = payload.rows;

    if (tab !== "ALL") {
      rows =
        tab === "INCOMPLETE"
          ? rows.filter((r) => r.is_incomplete)
          : rows.filter((r) => r.seat_type === tab);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [
          r.display_name,
          r.tech_id,
          r.office,
          r.reports_to_name,
          r.position_title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    return rows;
  }, [payload.rows, tab, search]);

  return (
    <div className="space-y-4">
      {/* Tabs + Search */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {payload.tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  "rounded-xl border px-3 py-2 text-sm",
                  tab === t.key
                    ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)]"
                    : "bg-card",
                ].join(" ")}
              >
                {tabLabel(t.key)} ({t.count})
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workforce…"
            className="h-10 w-full rounded-xl border px-3 text-sm lg:w-72"
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
          <div>{tabLabel(tab)}</div>
          <div>{filtered.length} rows</div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No records.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b text-[11px]">
                  <th className="px-4 py-3 text-left">Identity</th>
                  <th className="px-3 py-3 text-left">Office</th>
                  <th className="px-3 py-3 text-left">Reports To</th>
                  <th className="px-3 py-3 text-left">Seat</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={`${row.person_id}-${row.tech_id ?? "no-tech"}`}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer border-b hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{identityLabel(row)}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.position_title ?? "Unknown"}
                      </div>
                    </td>

                    <td className="px-3 py-3">{row.office ?? "—"}</td>

                    <td className="px-3 py-3">
                      {row.reports_to_name ?? (
                        <span className="text-[var(--to-warning)]">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-[11px]",
                          badgeTone(row.seat_type),
                        ].join(" ")}
                      >
                        {tabLabel(row.seat_type)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Workforce Detail
                </div>
                <h2 className="mt-1 text-lg font-semibold">
                  {identityLabel(selected)}
                </h2>
                <div className="mt-1 text-sm text-muted-foreground">
                  {selected.position_title ?? "Unknown Position"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-2xl border p-4">
              <div className="text-sm font-semibold">Quick Copy</div>
              <button
                type="button"
                onClick={() => {
                  const text = `${selected.display_name} • Tech ID: ${selected.tech_id ?? "N/A"}
Mobile:      ${selected.mobile ?? "—"}
NT Login:    ${selected.nt_login ?? "—"}
CSG:         ${selected.csg ?? "—"}
Email:       ${selected.email ?? "—"}
Affiliation: ${selected.affiliation ?? "—"}
Reports To:  ${selected.reports_to_name ?? "—"}`;

                  navigator.clipboard.writeText(text);
                }}
                className="mb-2 rounded-lg border px-3 py-1.5 text-xs"
              >
                Copy
              </button>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs leading-5">
                {`${selected.display_name} • Tech ID: ${selected.tech_id ?? "N/A"}
Mobile:      ${selected.mobile ?? "—"}
NT Login:    ${selected.nt_login ?? "—"}
CSG:         ${selected.csg ?? "—"}
Email:       ${selected.email ?? "—"}
Affiliation: ${selected.affiliation ?? "—"}
Reports To:  ${selected.reports_to_name ?? "—"}`}
              </pre>
            </div>

            <div className="mt-4 rounded-2xl border p-4">
              <div className="text-sm font-semibold">Stored Workforce Facts</div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Office</dt>
                  <dd>{selected.office ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reports To</dt>
                  <dd>{selected.reports_to_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Seat</dt>
                  <dd>{selected.seat_type}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{selected.assignment_status ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Start</dt>
                  <dd>{selected.start_date ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">End</dt>
                  <dd>{selected.end_date ?? "Active"}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}