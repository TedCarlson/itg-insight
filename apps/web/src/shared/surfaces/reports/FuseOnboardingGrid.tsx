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

type SortKey =
  | "fuse_date"
  | "contractor"
  | "candidate"
  | "tech"
  | "status"
  | "updated"
  | "history"
  | "id";

type SortDirection = "asc" | "desc";

const FILTERS: { key: keyof GridCounts; label: string }[] = [
  { key: "all", label: "All" },
  { key: "started", label: "Started" },
  { key: "background", label: "Background" },
  { key: "badge", label: "Badge" },
  { key: "consent", label: "Consent" },
  { key: "inactive", label: "Inactive" },
  { key: "history", label: "History" },
];

function SortHeader({
  sort,
  label,
  align = "left",
  activeSort,
  direction,
  onSort,
}: {
  sort: SortKey;
  label: string;
  align?: "left" | "center";
  activeSort: SortKey | null;
  direction: SortDirection;
  onSort: (sort: SortKey) => void;
}) {
  const indicator =
    activeSort === sort ? (direction === "asc" ? "↑" : "↓") : null;

  return (
    <th
      className={[
        "px-3 py-2 uppercase tracking-wide text-[var(--to-ink-muted)]",
        align === "center" ? "text-center" : "text-left",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onSort(sort)}
        className={[
          "inline-flex items-center gap-1 hover:text-[var(--to-ink)]",
          align === "center" ? "justify-center" : "justify-start",
        ].join(" ")}
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        {indicator ? <span aria-hidden="true">{indicator}</span> : null}
      </button>
    </th>
  );
}

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(false);

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    if (groups.length) sp.set("groups", groups.join(","));
    if (q.trim()) sp.set("q", q.trim());
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);

    if (sortKey) {
      sp.set("sort", sortKey);
      sp.set("direction", sortDirection);
    }

    return sp.toString();
  }, [
    page,
    groups,
    q,
    dateFrom,
    dateTo,
    sortKey,
    sortDirection,
  ]);

  function handleSort(nextKey: SortKey) {
    setPage(1);

    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection("asc");
      return;
    }

    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }

    setSortKey(null);
    setSortDirection("asc");
  }

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
  }, [params, refreshVersion]);

  return (
    <div className="rounded-2xl border border-[var(--to-border)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">FUSE Onboarding</div>
          <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
            Current FUSE candidates for the selected PC scope.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-[var(--to-ink-muted)]">
            {loading ? "Loading…" : `${count} candidates`}
          </div>

          <button
            type="button"
            onClick={() => setRefreshVersion((value) => value + 1)}
            disabled={loading}
            className="rounded-xl border px-3 py-1 text-xs disabled:opacity-40"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
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

        <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_160px_160px_auto]">
          <input
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
            placeholder="Search candidate, contractor, Tech ID..."
            className="h-9 min-w-0 rounded-xl border px-3 text-sm"
          />

          <label className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border px-3 text-xs text-[var(--to-ink-muted)]">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => {
                setPage(1);
                setDateFrom(event.target.value);
              }}
              className="min-w-0 bg-transparent text-sm text-[var(--to-ink)] outline-none"
            />
          </label>

          <label className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border px-3 text-xs text-[var(--to-ink-muted)]">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                setPage(1);
                setDateTo(event.target.value);
              }}
              className="min-w-0 bg-transparent text-sm text-[var(--to-ink)] outline-none"
            />
          </label>

          <button
            type="button"
            disabled={!q && !dateFrom && !dateTo}
            onClick={() => {
              setPage(1);
              setQ("");
              setDateFrom("");
              setDateTo("");
            }}
            className="h-9 rounded-xl border px-3 text-xs disabled:opacity-40"
          >
            Clear
          </button>
        </div>
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
              <SortHeader
                sort="fuse_date"
                label="FUSE Date"
                activeSort={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortHeader
                sort="contractor"
                label="Contractor"
                activeSort={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortHeader
                sort="candidate"
                label="Candidate"
                activeSort={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortHeader
                sort="tech"
                label="Tech"
                activeSort={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortHeader
                sort="status"
                label="Status"
                activeSort={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortHeader
                sort="updated"
                label="Updated"
                activeSort={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortHeader
                sort="history"
                label="Hist"
                align="center"
                activeSort={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortHeader
                sort="id"
                label="ID"
                align="center"
                activeSort={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
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
