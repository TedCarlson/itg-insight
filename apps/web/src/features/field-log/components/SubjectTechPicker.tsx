"use client";

import { useTechSearch, type TechSearchRow } from "../hooks/useTechSearch";

export function SubjectTechPicker(props: {
  enabled: boolean;
  pcOrgId: string | null;
  query: string;
  selectedTech: TechSearchRow | null;
  onQueryChange: (value: string) => void;
  onSelect: (value: TechSearchRow) => void;
  onClear: () => void;
}) {
  const { enabled, pcOrgId, query, selectedTech, onQueryChange, onSelect, onClear } = props;
  const { rows, loading } = useTechSearch({
    enabled,
    pcOrgId,
    query,
  });

  if (!enabled) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Technician</h2>

      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search technician by name or Tech ID"
        className="w-full rounded-lg border p-3"
      />

      {selectedTech ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
          <div className="font-semibold">
            {selectedTech.full_name ?? "Unknown"} • Tech ID: {selectedTech.tech_id ?? "—"}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="mt-2 text-xs font-medium text-blue-700"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {!selectedTech && query.trim().length >= 2 ? (
        <div className="rounded-xl border">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Searching technicians…</div>
          ) : rows.length > 0 ? (
            <div className="divide-y">
              {rows.map((row) => (
                <button
                  key={`${row.person_id}-${row.tech_id ?? "none"}`}
                  type="button"
                  onClick={() => onSelect(row)}
                  className="block w-full px-3 py-3 text-left hover:bg-muted/40"
                >
                  <div className="font-medium">{row.full_name ?? "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">
                    Tech ID: {row.tech_id ?? "—"}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-sm text-muted-foreground">No technicians found.</div>
          )}
        </div>
      ) : null}
    </section>
  );
}