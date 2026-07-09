"use client";

import { useEffect, useMemo, useState } from "react";

type FuseRow = {
  row_id: string;
  office_text: string | null;
  company_name: string | null;
  display_name: string | null;
  tech_id: string | null;
  personnel_id: string | null;
  snapshot_count: number | null;
  row_date: string | null;
  first_seen: string | null;
  last_seen: string | null;
  raw: Record<string, unknown> | null;
};

type GridCounts = {
  all: number;
  started: number;
  background: number;
  badge: number;
  consent: number;
  inactive: number;
  history: number;
};

type GridResponse = {
  rows: FuseRow[];
  count: number;
  counts?: GridCounts;
  pageSize: number;
};

const FILTERS: { key: keyof GridCounts; label: string }[] = [
  { key: "all", label: "All" },
  { key: "started", label: "Started" },
  { key: "background", label: "Background" },
  { key: "badge", label: "Badge" },
  { key: "consent", label: "Consent" },
  { key: "inactive", label: "Inactive" },
  { key: "history", label: "History" },
];

export function FuseOnboardingGrid() {
  const [rows, setRows] = useState<FuseRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<(keyof GridCounts)[]>([]);
  const [counts, setCounts] = useState<GridCounts>({
    all: 0,
    started: 0,
    background: 0,
    badge: 0,
    consent: 0,
    inactive: 0,
    history: 0,
  });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    if (groups.length) sp.set("groups", groups.join(","));
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [page, groups, q]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const res = await fetch(`/api/reports/fuse/onboarding/grid?${params}`, {
        cache: "no-store",
      });

      const json = (await res.json()) as GridResponse;

      if (!cancelled) {
        setRows(json.rows ?? []);
        setCount(json.count ?? 0);
        if (json.counts) setCounts(json.counts);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="rounded-2xl border border-[var(--to-border)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">FUSE Onboarding</div>
          <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
            Current FUSE candidates for the selected PC scope.
          </div>
        </div>

        <div className="text-xs text-[var(--to-ink-muted)]">
          {loading ? "Loading…" : `${count} candidates`}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const active =
              filter.key === "all"
                ? groups.length === 0
                : groups.includes(filter.key);

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => {
                  setPage(1);

                  if (filter.key === "all") {
                    setGroups([]);
                    return;
                  }

                  setGroups((current) =>
                    current.includes(filter.key)
                      ? current.filter((item) => item !== filter.key)
                      : [...current, filter.key]
                  );
                }}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition",
                  active
                    ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_12%,white)]"
                    : "bg-muted/20 text-[var(--to-ink-muted)]",
                ].join(" ")}
              >
                {active && filter.key !== "all" ? "✓ " : ""}
                {filter.label} ({counts[filter.key] ?? 0})
              </button>
            );
          })}
        </div>

        <input
          value={q}
          onChange={(event) => {
            setPage(1);
            setQ(event.target.value);
          }}
          placeholder="Search candidate, contractor, Tech ID..."
          className="h-9 w-full rounded-xl border px-3 text-sm"
        />
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--to-border)]">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: "13%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>

          <thead>
            <tr className="border-b bg-[var(--to-surface-soft)]">
              <th className="px-3 py-2 text-left uppercase tracking-wide text-[var(--to-ink-muted)]">FUSE Date</th>
              <th className="px-3 py-2 text-left uppercase tracking-wide text-[var(--to-ink-muted)]">Contractor</th>
              <th className="px-3 py-2 text-left uppercase tracking-wide text-[var(--to-ink-muted)]">Candidate</th>
              <th className="px-3 py-2 text-left uppercase tracking-wide text-[var(--to-ink-muted)]">Tech</th>
              <th className="px-3 py-2 text-left uppercase tracking-wide text-[var(--to-ink-muted)]">Status</th>
              <th className="px-3 py-2 text-left uppercase tracking-wide text-[var(--to-ink-muted)]">Updated</th>
              <th className="px-3 py-2 text-center uppercase tracking-wide text-[var(--to-ink-muted)]">Hist</th>
              <th className="px-3 py-2 text-center uppercase tracking-wide text-[var(--to-ink-muted)]">ID</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.row_id} className="border-b last:border-b-0">
                <td className="px-3 py-2 truncate">{row.row_date ?? "—"}</td>
                <td className="px-3 py-2 truncate">{row.company_name ?? "—"}</td>
                <td className="px-3 py-2 font-medium truncate">{row.display_name ?? "—"}</td>
                <td className="px-3 py-2 truncate">{row.tech_id && row.tech_id !== "N/A" ? row.tech_id : "—"}</td>
                <td className="px-3 py-2 truncate">{String(row.raw?.Status ?? "—")}</td>
                <td className="px-3 py-2 truncate">{String(row.raw?.["Status Update"] ?? "—")}</td>
                <td className="px-3 py-2 text-center tabular-nums">{row.snapshot_count ?? 1}</td>
                <td className="px-3 py-2 text-center">{row.personnel_id && row.personnel_id !== "N/A" ? "✓" : "—"}</td>
              </tr>
            ))}

            {!rows.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[var(--to-ink-muted)]">
                  No FUSE onboarding rows found for this PC scope.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-[var(--to-ink-muted)]">
          Page {page} of {pageCount}
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-xl border px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>

          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            className="rounded-xl border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
