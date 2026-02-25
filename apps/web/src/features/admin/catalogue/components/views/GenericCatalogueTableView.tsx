// RUN THIS
// Replace the entire file:
// apps/web/src/features/admin/catalogue/components/views/GenericCatalogueTableView.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { RecordDrawer } from "@/features/admin/catalogue/components/RecordDrawer";

type CatalogueColumn = {
  key: string;
  label: string;
  type?: string;
  editable?: boolean;
  readonlyReason?: string;
};

type CatalogueResponse = {
  columns: CatalogueColumn[];
  rows: Record<string, any>[];
};

function isUuidLike(v: unknown) {
  if (typeof v !== "string") return false;
  return /^[0-9a-fA-F-]{20,}$/.test(v);
}

function fmtCell(v: unknown) {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "—";
  if (typeof v === "string") return v === "" ? "—" : v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function shortText(v: unknown, max = 48) {
  const s = fmtCell(v);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function pickRowKey(row: Record<string, any>, columns: CatalogueColumn[]) {
  const candidates = [...columns.map((c) => c.key), "id", "uuid"];

  const pk =
    candidates.find((k) => k && (k === "id" || k.endsWith("_id")) && row[k] != null) ??
    candidates.find((k) => isUuidLike(row[k])) ??
    null;

  const pkVal = pk ? row[pk] : null;

  return {
    pk,
    pkVal: pkVal == null ? null : String(pkVal),
  };
}

function CopyButton(props: { value: string }) {
  return (
    <button
      type="button"
      className="to-btn inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs"
      style={{ borderColor: "var(--to-border)" }}
      onClick={async () => {
        await navigator.clipboard.writeText(String(props.value));
      }}
      title="Copy"
    >
      Copy
    </button>
  );
}

export function GenericCatalogueTableView(props: { table: string }) {
  const { table } = props;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<CatalogueResponse>({ columns: [], rows: [] });

  const [q, setQ] = useState("");

  // drawer
  const [open, setOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<Record<string, any> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActiveRow(null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/catalogue/${encodeURIComponent(table)}?limit=200`, {
        method: "GET",
      });

      const json = (await res.json()) as { error?: string } & Partial<CatalogueResponse>;
      if (!res.ok) throw new Error(json.error ?? "Failed to load");

      const columns = Array.isArray(json.columns) ? json.columns : [];
      const rows = Array.isArray(json.rows) ? (json.rows as Record<string, any>[]) : [];

      setData({ columns, rows });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
      setData({ columns: [], rows: [] });
    } finally {
      setLoading(false);
    }
  }, [table]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const columns = data.columns;
  const rows = data.rows;

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((r) => {
      for (const c of columns) {
        const v = r[c.key];
        const s = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
        if (s.toLowerCase().includes(term)) return true;
      }
      return false;
    });
  }, [rows, columns, q]);

  const summary = useMemo(() => {
    if (loading) return "Loading…";
    if (err) return "Error";
    return `${filteredRows.length} rows`;
  }, [loading, err, filteredRows.length]);

  const displayCols = useMemo(() => columns.slice(0, Math.min(columns.length, 12)), [columns]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{table}</h2>
          <div className="text-xs text-[var(--to-ink-muted)]">Table: {table} • {summary}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[260px]">
            <TextInput value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="Search…" />
          </div>

          <button
            type="button"
            className="to-btn inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
            onClick={() => refresh()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <Card variant="subtle" className="p-3">
          <div className="text-sm" style={{ color: "var(--to-danger)" }}>
            {err}
          </div>
        </Card>
      ) : null}

      {!loading && filteredRows.length === 0 ? (
        <EmptyState title="No rows" message="Try adjusting your search." compact />
      ) : (
        <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--to-surface-2)]">
              <tr className="text-left">
                {displayCols.map((c) => (
                  <th key={c.key} className="px-3 py-2 whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r, idx) => {
                const { pkVal } = pickRowKey(r, columns);

                return (
                  <tr
                    key={(pkVal ?? idx.toString()) + ":" + idx.toString()}
                    className={[
                      "cursor-pointer",
                      idx % 2 === 1 ? "bg-[var(--to-surface)]" : "bg-[var(--to-surface-soft)]",
                      "hover:bg-[var(--to-surface-2)]",
                    ].join(" ")}
                    onClick={() => {
                      setActiveRow(r);
                      setOpen(true);
                    }}
                    title="Click to view row"
                  >
                    {displayCols.map((c) => (
                      <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                        {shortText(r[c.key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RecordDrawer
        open={open}
        onClose={close}
        title={table}
        subtitle={
          activeRow
            ? (() => {
                const { pk, pkVal } = pickRowKey(activeRow, columns);
                if (!pk || !pkVal) return "Row details";
                return `${pk}: ${pkVal}`;
              })()
            : undefined
        }
        footer={
          activeRow
            ? (() => {
                const { pk, pkVal } = pickRowKey(activeRow, columns);
                if (!pk || !pkVal) return null;
                return (
                  <div className="flex items-center justify-between w-full">
                    <div className="text-xs font-mono text-[var(--to-ink-muted)]">
                      {pk}: {pkVal}
                    </div>
                    <CopyButton value={pkVal} />
                  </div>
                );
              })()
            : undefined
        }
      >
        {activeRow ? (
          <pre
            className="rounded border p-3 text-xs overflow-auto"
            style={{ borderColor: "var(--to-border)", background: "var(--to-surface-soft)" }}
          >
            {JSON.stringify(activeRow, null, 2)}
          </pre>
        ) : null}

        <div className="mt-3 text-xs text-[var(--to-ink-muted)]">
          This generic view is read-only for now. (Editing is enabled only for tables allowed by the PATCH route.)
        </div>
      </RecordDrawer>
    </div>
  );
}