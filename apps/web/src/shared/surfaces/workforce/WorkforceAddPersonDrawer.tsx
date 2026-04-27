// path: apps/web/src/shared/surfaces/workforce/WorkforceAddPersonDrawer.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";

export type WorkforcePersonSearchRow = {
  person_id: string;
  full_name: string | null;
  tech_id: string | null;
  position_title: string | null;
  is_in_workforce: boolean;
  assignment_id: string | null;
  active_assignment_count: number;
  active_here_label: string | null;
  active_elsewhere_label: string | null;
};

type Props = {
  pcOrgId: string | null;
  open: boolean;
  onClose: () => void;
  onStageAdd: (row: WorkforcePersonSearchRow) => void;
};

function statusLabel(row: WorkforcePersonSearchRow) {
  if (row.is_in_workforce) {
    return row.active_here_label
      ? `Active here: ${row.active_here_label}`
      : "Active in this workforce";
  }

  if (row.active_elsewhere_label) {
    return `Active elsewhere: ${row.active_elsewhere_label}`;
  }

  if (row.active_assignment_count > 0) {
    return `${row.active_assignment_count} active assignment${
      row.active_assignment_count === 1 ? "" : "s"
    }`;
  }

  return "No active workforce assignment";
}

function statusTone(row: WorkforcePersonSearchRow) {
  if (row.is_in_workforce) return "bg-muted text-muted-foreground";
  if (row.active_elsewhere_label) {
    return "border-[var(--to-info)] bg-[color-mix(in_oklab,var(--to-info)_10%,white)]";
  }
  return "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]";
}

export function WorkforceAddPersonDrawer({
  pcOrgId,
  open,
  onClose,
  onStageAdd,
}: Props) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<WorkforcePersonSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSearch = Boolean(pcOrgId);

  useEffect(() => {
    if (!open || !canSearch) return;

    let cancelled = false;

    async function search() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("pc_org_id", pcOrgId ?? "");
      params.set("q", query);

      const res = await fetch(
        `/api/workforce/person-search?${params.toString()}`
      );
      const json = await res.json().catch(() => null);

      if (cancelled) return;

      if (!res.ok) {
        setRows([]);
        setError(json?.error ?? "Unable to search people.");
        setLoading(false);
        return;
      }

      setRows(json?.rows ?? []);
      setLoading(false);
    }

    const timer = window.setTimeout(search, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, canSearch, pcOrgId, query]);

  const showCreateNew = useMemo(() => {
    return query.trim().length >= 2 && !loading && rows.length === 0 && !error;
  }, [query, loading, rows.length, error]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Workforce
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              Add Person to Workforce
            </h2>
            <div className="mt-1 text-sm text-muted-foreground">
              Search existing people first. Use assignment context to decide
              whether to add locally, add as travel, or open the existing row.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            Close
          </button>
        </div>

        <Card className="mt-5 p-4">
          <label className="grid gap-1 text-sm">
            Search People
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or tech ID…"
              className="h-10 rounded-xl border px-3"
            />
          </label>

          {!canSearch ? (
            <div className="mt-3 rounded-xl border border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_8%,white)] p-3 text-xs">
              Missing pc_org_id. Workforce add cannot search yet.
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-xl border border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_8%,white)] p-3 text-xs">
              {error}
            </div>
          ) : null}

          <div className="mt-3 text-xs text-muted-foreground">
            {loading ? "Searching…" : `${rows.length} results`}
          </div>
        </Card>

        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.person_id} className="rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {row.full_name ?? "Unknown Person"}
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.tech_id ? `Tech ID: ${row.tech_id}` : "No Tech ID"}
                    {row.position_title ? ` • ${row.position_title}` : ""}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={[
                        "rounded-full border px-2 py-1 text-[11px]",
                        statusTone(row),
                      ].join(" ")}
                    >
                      {statusLabel(row)}
                    </span>

                    {row.active_assignment_count > 1 ? (
                      <span className="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
                        {row.active_assignment_count} active assignments
                      </span>
                    ) : null}
                  </div>
                </div>

                {row.is_in_workforce ? (
                  <button
                    type="button"
                    disabled
                    className="rounded-xl border bg-muted px-3 py-2 text-xs text-muted-foreground"
                  >
                    Already Here
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onStageAdd(row)}
                    className="rounded-xl border border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] px-3 py-2 text-xs"
                  >
                    Stage Add
                  </button>
                )}
              </div>
            </div>
          ))}

          {showCreateNew ? (
            <div className="rounded-2xl border border-dashed p-4">
              <div className="text-sm font-medium">No matching person found</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Next step will create a new person first, then stage them for
                workforce.
              </div>
              <button
                type="button"
                disabled
                className="mt-3 rounded-xl border bg-muted px-3 py-2 text-xs text-muted-foreground"
              >
                Create New Person Pending
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}