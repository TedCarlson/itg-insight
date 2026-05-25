// apps/web/src/app/route-lock/routes/RoutesAdminClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";

type RouteAdminRow = {
  route_id: string;
  route_name: string;
  pc_org_id: string;

  pc_org_name: string | null;
  pc_number: string | number | null;

  mso_name: string | null;

  division_name: string | null;
  division_code: string | null;

  region_name: string | null;
  region_code: string | null;
};

const STORAGE_KEY = "pc:selected_org_id";

async function postJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json as T;
}

export default function RoutesAdminClient() {
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<RouteAdminRow[]>([]);
  const [query, setQuery] = useState("");

  // left panel form
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");

  // watch org selection so this page doesn't get "stuck" on the previous org's list
  const [orgKey, setOrgKey] = useState<string | null>(null);
  const lastOrgKeyRef = useRef<string | null>(null);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (rows ?? []).find((r) => r.route_id === selectedId) ?? null;
  }, [rows, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (rows ?? []).slice();

    const out = !q
      ? list
      : list.filter((r) => {
        const hay = [
          r.route_name,
          r.pc_org_name,
          r.mso_name,
          r.division_name,
          r.division_code,
          r.region_name,
          r.region_code,
          r.pc_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });

    out.sort((a, b) => a.route_name.localeCompare(b.route_name, undefined, { sensitivity: "base" }));
    return out;
  }, [rows, query]);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const json = await postJson<{ ok: true; items: RouteAdminRow[] }>("/api/route-lock/routes/list", {});
      setRows(json.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load routes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    void load();
  }, []);

  // org selection watcher (same-tab)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const read = () => window.localStorage.getItem(STORAGE_KEY);
    const initial = read();
    lastOrgKeyRef.current = initial;
    setOrgKey(initial);

    const t = window.setInterval(() => {
      const next = read();
      if (next !== lastOrgKeyRef.current) {
        lastOrgKeyRef.current = next;
        setOrgKey(next);
      }
    }, 900);

    return () => window.clearInterval(t);
  }, []);

  // when org changes: clear selection + reload list
  useEffect(() => {
    // ignore the very first set (mount)
    if (orgKey === null && lastOrgKeyRef.current === null) return;

    // Clear form so we don't accidentally edit a route from a different org
    setSelectedId(null);
    setRouteName("");
    setQuery("");
    void load();
  }, [orgKey]);

  const clearForm = () => {
    setSelectedId(null);
    setRouteName("");
  };

  const choose = (r: RouteAdminRow) => {
    setSelectedId(r.route_id);
    setRouteName(r.route_name ?? "");
  };

  const save = async () => {
    const name = routeName.trim();
    if (!name) {
      toast.push({ title: "Missing name", message: "Enter a route name.", variant: "warning" });
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      const json = await postJson<{ ok: true; item: RouteAdminRow }>("/api/route-lock/routes/upsert", {
        route_id: selectedId,
        route_name: name,
      });

      toast.push({
        title: selectedId ? "Saved" : "Created",
        message: selectedId ? "Route updated." : "Route created.",
        variant: "success",
      });

      await load();

      // keep selection on save
      setSelectedId(json.item.route_id);
      setRouteName(json.item.route_name ?? "");
    } catch (e: any) {
      const msg = e?.message ?? "Save failed";
      setErr(msg);
      toast.push({ title: "Save failed", message: msg, variant: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {err ? (
        <Notice variant="danger" title="Routes error">
          <div className="text-sm">{err}</div>
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: upsert/edit */}
        <div className="rounded-xl border p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold">{selected ? "Edit route" : "Add route"}</div>
            <div className="text-xs text-[var(--to-ink-muted)]">
              Writes to <code>public.route</code>. List is from <code>public.route_admin_v</code>.
            </div>
          </div>

          {selected ? (
            <div className="text-xs text-[var(--to-ink-muted)] space-y-1">
              <div>
                <span className="font-mono">route_id:</span> <span className="font-mono">{selected.route_id}</span>
              </div>
              <div>
                <span className="font-mono">pc_org:</span> {selected.pc_org_name ?? "—"}{" "}
                <span className="text-[11px]">• PC {selected.pc_number ?? "—"}</span>
              </div>
              <div>
                <span className="font-mono">region/div:</span>{" "}
                {(selected.region_code ?? selected.region_name ?? "—") +
                  " / " +
                  (selected.division_code ?? selected.division_name ?? "—")}
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <div className="text-xs text-[var(--to-ink-muted)]">Route name</div>
            <TextInput
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g. North Line, Route A…"
              className="w-full h-10"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") clearForm();
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={save} disabled={loading} className="h-10 px-3 text-xs">
              {loading ? "Saving…" : selected ? "Save changes" : "Add route"}
            </Button>

            <Button type="button" variant="secondary" onClick={clearForm} disabled={loading} className="h-10 px-3 text-xs">
              Clear
            </Button>

            <div className="ml-auto">
              <Button type="button" variant="secondary" onClick={load} disabled={loading} className="h-10 px-3 text-xs">
                {loading ? "Refreshing…" : "Refresh list"}
              </Button>
            </div>
          </div>

          <div className="text-[11px] text-[var(--to-ink-muted)]">
            Access note: admins/owners bypass grants; scoped users require <code>route_lock_manage</code>.
          </div>
        </div>

        {/* RIGHT: quick scan list */}
        <div className="rounded-xl border overflow-hidden">
          <div className="p-3 border-b bg-[var(--to-surface)]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Existing routes</div>
                <div className="text-xs text-[var(--to-ink-muted)]">{filtered.length} shown</div>
              </div>

              <div className="ml-auto w-full sm:w-[320px]">
                <TextInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Quick scan (name, region, division, PC)…"
                  className="w-full h-10"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {loading && rows.length === 0 ? (
            <div className="p-3 text-sm text-[var(--to-ink-muted)]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-sm text-[var(--to-ink-muted)]">No routes yet.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const active = r.route_id === selectedId;
                return (
                  <button
                    key={r.route_id}
                    type="button"
                    onClick={() => choose(r)}
                    className={[
                      "w-full text-left px-3 py-2 hover:bg-[var(--to-surface)]",
                      active ? "bg-[var(--to-surface)]" : "",
                    ].join(" ")}
                    title="Click to edit"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.route_name}</div>
                        <div className="text-[11px] text-[var(--to-ink-muted)] truncate">
                          {r.pc_org_name ?? "—"} •
                          {" "}
                          {r.region_code ?? r.region_name ?? "—"}
                          {" / "}
                          {r.division_code ?? r.division_name ?? "—"}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--to-ink-muted)]">
                        PC {r.pc_number ?? "—"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}