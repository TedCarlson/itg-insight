"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";

type Row = {
  state_code: string;
  state_name: string;
  backlog_seed: number;
  default_manpower: number;
};

type Draft = Row;

const emptyDraft: Draft = {
  state_code: "",
  state_name: "",
  backlog_seed: 0,
  default_manpower: 0,
};

export function LocateStateResourceTableView() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      sp.set("pageIndex", "0");
      sp.set("pageSize", "100");
      const res = await fetch(`/api/admin/catalogue/locate_state_resource?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load states");
      setRows(json.rows ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load states");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeDraft = editing ?? draft;
  const isEditing = Boolean(editing);

  const canSave = useMemo(() => {
    return /^[A-Za-z]{2}$/.test(activeDraft.state_code) && activeDraft.state_name.trim().length > 0 && !saving;
  }, [activeDraft, saving]);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setErr(null);

    try {
      const payload = {
        state_code: activeDraft.state_code.trim().toUpperCase(),
        state_name: activeDraft.state_name.trim(),
        backlog_seed: Number(activeDraft.backlog_seed ?? 0),
        default_manpower: Number(activeDraft.default_manpower ?? 0),
      };

      const res = await fetch(
        isEditing
          ? `/api/admin/catalogue/locate_state_resource/${encodeURIComponent(payload.state_code)}`
          : "/api/admin/catalogue/locate_state_resource",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");

      setDraft(emptyDraft);
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function setActiveDraft(next: Partial<Draft>) {
    if (editing) setEditing({ ...editing, ...next });
    else setDraft({ ...draft, ...next });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Locate States</h2>
          <div className="text-xs text-[var(--to-ink-muted)]">
            Table: locate_state_resource • {rows.length} rows
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-[300px]">
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search state…" />
          </div>
          <button
            type="button"
            className="to-btn inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <Card variant="subtle" className="p-3">
          <div className="text-sm" style={{ color: "var(--to-danger)" }}>{err}</div>
        </Card>
      ) : null}

      <Card variant="subtle" className="p-3">
        <div className="grid gap-3 md:grid-cols-[120px_1fr_140px_160px_auto] md:items-end">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-[var(--to-ink-muted)]">Code</label>
            <input
              className="to-input"
              value={activeDraft.state_code}
              onChange={(e) => setActiveDraft({ state_code: e.target.value.toUpperCase().slice(0, 2) })}
              disabled={isEditing}
              placeholder="PA"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-[var(--to-ink-muted)]">State name</label>
            <input
              className="to-input"
              value={activeDraft.state_name}
              onChange={(e) => setActiveDraft({ state_name: e.target.value })}
              placeholder="Pennsylvania"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-[var(--to-ink-muted)]">Backlog seed</label>
            <input
              className="to-input"
              type="number"
              min={0}
              value={activeDraft.backlog_seed}
              onChange={(e) => setActiveDraft({ backlog_seed: Number(e.target.value) })}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-[var(--to-ink-muted)]">Default manpower</label>
            <input
              className="to-input"
              type="number"
              min={0}
              value={activeDraft.default_manpower}
              onChange={(e) => setActiveDraft({ default_manpower: Number(e.target.value) })}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="to-btn to-btn--primary inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
              onClick={() => void save()}
              disabled={!canSave}
            >
              {saving ? "Saving…" : isEditing ? "Save" : "Add"}
            </button>
            {isEditing ? (
              <button
                type="button"
                className="to-btn inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
                style={{ borderColor: "var(--to-border)" }}
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
        <table className="w-full text-sm">
          <thead className="bg-[var(--to-surface-2)]">
            <tr className="text-left">
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2 text-right">Backlog Seed</th>
              <th className="px-3 py-2 text-right">Default Manpower</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.state_code} className="border-t" style={{ borderColor: "var(--to-border)" }}>
                <td className="px-3 py-2 font-mono">{row.state_code}</td>
                <td className="px-3 py-2">{row.state_name}</td>
                <td className="px-3 py-2 text-right">{row.backlog_seed}</td>
                <td className="px-3 py-2 text-right">{row.default_manpower}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="to-btn inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
                    style={{ borderColor: "var(--to-border)" }}
                    onClick={() => setEditing(row)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
