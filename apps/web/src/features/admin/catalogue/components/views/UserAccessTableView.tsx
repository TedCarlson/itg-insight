// RUN THIS
// Replace the entire file:
// apps/web/src/features/admin/catalogue/components/views/UserAccessTableView.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

import { useOrg } from "@/state/org";

type PersonRow = {
  person_id: string;
  full_name: string;
  emails: string | null;
  active: boolean;
};

type JsonValue = any;

async function fetchJsonSafe(
  input: RequestInfo,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json: JsonValue; rawText?: string }> {
  const res = await fetch(input, init);
  const status = res.status;

  const text = await res.text().catch(() => "");
  if (!text) return { ok: res.ok, status, json: null, rawText: "" };

  try {
    const json = JSON.parse(text);
    return { ok: res.ok, status, json, rawText: text };
  } catch {
    return {
      ok: false,
      status,
      json: { ok: false, error: "non_json_response", raw: text },
      rawText: text,
    };
  }
}

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function UserAccessTableView() {
  const toast = useToast();
  const { selectedOrgId } = useOrg();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState<PersonRow[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const [authUserId, setAuthUserId] = useState("");

  // Debug capture (so we don’t guess what the server said)
  const [lastDebug, setLastDebug] = useState<JsonValue | null>(null);

  const selected = useMemo(() => {
    if (!selectedPersonId) return null;
    return rows.find((r) => r.person_id === selectedPersonId) ?? null;
  }, [rows, selectedPersonId]);

  const runSearch = useCallback(async () => {
    const query = q.trim();
    if (!query) {
      toast.push({ title: "User Access", message: "Type a name or email fragment to search.", variant: "warning" });
      return;
    }

    setLoading(true);
    try {
      const url = `/api/admin/user-access/person-search?q=${encodeURIComponent(query)}`;
      const out = await fetchJsonSafe(url);
      setLastDebug(out.json);

      if (!out.ok || !out.json?.ok) {
        throw new Error(out.json?.error ?? `Search failed (${out.status})`);
      }

      const list = (Array.isArray(out.json?.rows) ? out.json.rows : []) as PersonRow[];
      setRows(list);

      if (selectedPersonId && !list.some((r) => r.person_id === selectedPersonId)) {
        setSelectedPersonId(null);
      }
    } catch (e: any) {
      toast.push({ title: "User Access", message: e?.message ?? "Search failed", variant: "danger" });
      setRows([]);
      setSelectedPersonId(null);
    } finally {
      setLoading(false);
    }
  }, [q, toast, selectedPersonId]);

  const linkPersonToAuthUser = useCallback(async () => {
    if (!selected) {
      toast.push({ title: "User Access", message: "Select a person first.", variant: "warning" });
      return;
    }
    const id = authUserId.trim();
    if (!id) {
      toast.push({ title: "User Access", message: "Enter an auth_user_id (uuid).", variant: "warning" });
      return;
    }

    setLoading(true);
    try {
      const out = await fetchJsonSafe("/api/admin/user-access/link-person", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ auth_user_id: id, person_id: selected.person_id }),
      });
      setLastDebug(out.json);

      if (!out.ok || !out.json?.ok) throw new Error(out.json?.error ?? `Link failed (${out.status})`);

      toast.push({ title: "User Access", message: "Linked auth user ↔ person.", variant: "success" });
    } catch (e: any) {
      toast.push({ title: "User Access", message: e?.message ?? "Link failed", variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [authUserId, selected, toast]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[260px] flex-1">
          <div className="text-sm font-semibold">User Access</div>
          <div className="mt-0.5 text-xs text-[var(--to-ink-muted)]">
            Find a person row, link an auth user, and manage access (owner/admin guarded server-side).
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search person name or email fragment…"
              className="min-w-[260px] flex-1"
            />
            <Button onClick={runSearch} disabled={loading} className="h-9 px-4">
              {loading ? "Searching…" : "Search"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="text-xs text-[var(--to-ink-muted)]">Org context</div>
          <Badge>{selectedOrgId ? selectedOrgId.slice(0, 8) : "No org selected"}</Badge>
        </div>
      </div>

      {rows.length === 0 ? (
        <Notice title="No results yet" variant="info">
          Run a search above. Results will appear here.
        </Notice>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => {
            const active = r.person_id === selectedPersonId;
            return (
              <button
                key={r.person_id}
                type="button"
                onClick={() => setSelectedPersonId(r.person_id)}
                className={cls(
                  "w-full rounded-xl border px-3 py-2 text-left transition",
                  active ? "ring-2 ring-[var(--to-focus)] bg-[var(--to-row-hover)]" : "hover:bg-[var(--to-row-hover)]"
                )}
                style={{ borderColor: "var(--to-border)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.full_name}</div>
                    <div className="truncate text-xs text-[var(--to-ink-muted)]">{r.emails ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.active ? "success" : "warning"}>{r.active ? "active" : "inactive"}</Badge>
                    <span className="text-[11px] text-[var(--to-ink-muted)]">{r.person_id.slice(0, 8)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border bg-[var(--to-surface)] p-4" style={{ borderColor: "var(--to-border)" }}>
        <div className="text-sm font-semibold">Link auth user ↔ person</div>
        <div className="mt-0.5 text-xs text-[var(--to-ink-muted)]">
          Bridge auth users to person rows when appropriate. (If the API route isn’t wired yet, the debug box will show the
          response.)
        </div>

        <div className="mt-3 grid gap-2">
          <div className="text-xs text-[var(--to-ink-muted)]">
            Selected person:{" "}
            {selected ? (
              <span className="text-[var(--to-ink)]">
                {selected.full_name} ({selected.person_id.slice(0, 8)})
              </span>
            ) : (
              <span className="text-[var(--to-ink-muted)]">none</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <TextInput
              value={authUserId}
              onChange={(e) => setAuthUserId(e.target.value)}
              placeholder="auth_user_id (uuid)…"
              className="min-w-[260px] flex-1"
            />
            <Button onClick={linkPersonToAuthUser} disabled={loading || !selected} className="h-9 px-4">
              Link
            </Button>
          </div>

          <div className="text-[11px] text-[var(--to-ink-muted)]">No silent failures — last payload is captured below.</div>
        </div>
      </div>

      <div className="rounded-xl border bg-[var(--to-surface)] p-4" style={{ borderColor: "var(--to-border)" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Debug payload</div>
            <div className="text-xs text-[var(--to-ink-muted)]">Last API response captured here.</div>
          </div>
          <Button variant="secondary" className="h-8 px-3 text-sm" onClick={() => setLastDebug(null)}>
            Clear
          </Button>
        </div>

        <pre
          className="mt-3 max-h-[320px] overflow-auto rounded-lg border bg-[var(--to-surface-2)] p-3 text-xs"
          style={{ borderColor: "var(--to-border)" }}
        >
{JSON.stringify(lastDebug, null, 2)}
        </pre>
      </div>
    </div>
  );
}