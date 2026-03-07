"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { useUserProfileAdmin } from "../../hooks/useUserProfileAdmin";

type PersonSearchRow = {
  person_id: string;
  full_name: string;
  emails: string | null;
  active: boolean;
};

type PcOrgOption = {
  pc_org_id: string;
  pc_org_name: string | null;
};

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtTs(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

export function UserProfileTableView() {
  const toast = useToast();
  const { q, setQ, data, loading, saving, err, pageIndex, setPageIndex, pageSize, setPageSize, refresh, saveProfile } =
    useUserProfileAdmin({ pageSize: 25 });

  const rows = useMemo(() => {
    return data?.rows ?? []
    }, [data])
  const totalRows = data?.page.totalRows ?? 0;
  const canPrev = pageIndex > 0;
  const canNext = (pageIndex + 1) * pageSize < totalRows;

  const [selectedAuthUserId, setSelectedAuthUserId] = useState<string | null>(null);
  const selected = useMemo(
    () => rows.find((r) => r.auth_user_id === selectedAuthUserId) ?? rows[0] ?? null,
    [rows, selectedAuthUserId]
  );

  const [statusDraft, setStatusDraft] = useState("pending");
  const [personIdDraft, setPersonIdDraft] = useState("");
  const [selectedPcOrgDraft, setSelectedPcOrgDraft] = useState("");
  const [isAdminDraft, setIsAdminDraft] = useState(false);

  const [personSearch, setPersonSearch] = useState("");
  const [personResults, setPersonResults] = useState<PersonSearchRow[]>([]);
  const [personLoading, setPersonLoading] = useState(false);

  const [pcOrgOptions, setPcOrgOptions] = useState<PcOrgOption[]>([]);
  const [pcOrgLoading, setPcOrgLoading] = useState(false);

  useEffect(() => {
    if (!selectedAuthUserId && rows[0]?.auth_user_id) {
      setSelectedAuthUserId(rows[0].auth_user_id);
    }
  }, [rows, selectedAuthUserId]);

  useEffect(() => {
    if (!selected) return;
    setStatusDraft(selected.status ?? "pending");
    setPersonIdDraft(selected.person_id ?? "");
    setSelectedPcOrgDraft(selected.selected_pc_org_id ?? "");
    setIsAdminDraft(selected.is_admin === true);
    setPersonSearch(selected.person_full_name ?? "");
    setPersonResults([]);
  }, [selected]);

  useEffect(() => {
    let cancelled = false;

    async function loadPcOrgs() {
      setPcOrgLoading(true);
      try {
        const res = await fetch("/api/admin/catalogue/user_profile/lookups", { method: "GET" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Failed to load orgs");
        if (!cancelled) {
          setPcOrgOptions(Array.isArray(json?.orgs) ? json.orgs : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setPcOrgOptions([]);
          toast.push({ title: "User Profile", message: e?.message ?? "Failed to load org list", variant: "danger" });
        }
      } finally {
        if (!cancelled) setPcOrgLoading(false);
      }
    }

    void loadPcOrgs();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function runPersonSearch() {
    setPersonLoading(true);
    try {
      const sp = new URLSearchParams();
      if (personSearch.trim()) sp.set("q", personSearch.trim());

      const res = await fetch(`/api/admin/catalogue/user_profile/person-search?${sp.toString()}`, { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to search person");
      setPersonResults(Array.isArray(json?.rows) ? json.rows : []);
    } catch (e: any) {
      setPersonResults([]);
      toast.push({ title: "User Profile", message: e?.message ?? "Failed to search person", variant: "danger" });
    } finally {
      setPersonLoading(false);
    }
  }

  async function onSave() {
    if (!selected) return;

    const result = await saveProfile({
      auth_user_id: selected.auth_user_id,
      status: statusDraft,
      person_id: personIdDraft.trim() || null,
      selected_pc_org_id: selectedPcOrgDraft.trim() || null,
      is_admin: isAdminDraft,
    });

    if (!result.ok) {
      toast.push({ title: "User Profile", message: result.error ?? "Save failed", variant: "danger" });
      return;
    }

    toast.push({ title: "User Profile", message: "Profile saved.", variant: "success" });
  }

  const summary = useMemo(() => {
    if (loading) return "Loading…";
    if (err) return "Error";
    return `${totalRows} rows`;
  }, [loading, err, totalRows]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">User Profile</h2>
          <div className="text-xs text-[var(--to-ink-muted)]">Table: user_profile • {summary}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[280px]">
            <TextInput value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="Search auth id, email, person, org…" />
          </div>

          <Button variant="secondary" className="h-9 px-3 text-sm" onClick={() => refresh()} disabled={loading || saving}>
            Refresh
          </Button>
        </div>
      </div>

      {err ? (
        <Notice title="User Profile load error" variant="danger">
          {err}
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.95fr)]">
        <div>
          {!loading && rows.length === 0 ? (
            <EmptyState title="No profiles found" message="Try adjusting your search." compact />
          ) : (
            <div className="overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
              <table className="w-full text-sm">
                <thead className="bg-[var(--to-surface-2)]">
                  <tr className="text-left">
                    <th className="px-3 py-2 whitespace-nowrap">Email / Auth</th>
                    <th className="px-3 py-2 whitespace-nowrap">Person</th>
                    <th className="px-3 py-2 whitespace-nowrap">Status</th>
                    <th className="px-3 py-2 whitespace-nowrap">Selected Org</th>
                    <th className="px-3 py-2 whitespace-nowrap">Admin</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r, idx) => {
                    const active = selected?.auth_user_id === r.auth_user_id;
                    return (
                      <tr
                        key={r.auth_user_id}
                        className={cls(
                          idx % 2 === 1 ? "bg-[var(--to-surface)]" : "bg-[var(--to-surface-soft)]",
                          active && "ring-2 ring-[var(--to-focus)]"
                        )}
                      >
                        <td className="px-3 py-2 align-top">
                          <button type="button" className="w-full text-left" onClick={() => setSelectedAuthUserId(r.auth_user_id)}>
                            <div className="font-medium">{r.email ?? "—"}</div>
                            <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">{r.auth_user_id}</div>
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div>{r.person_full_name ?? "—"}</div>
                          <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">{r.person_id ?? "—"}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant={r.status === "active" ? "success" : r.status === "inactive" ? "warning" : "neutral"}>
                            {r.status ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div>{r.selected_pc_org_name ?? "—"}</div>
                          <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">{r.selected_pc_org_id ?? "—"}</div>
                        </td>
                        <td className="px-3 py-2 align-top">{r.is_admin ? "Yes" : "No"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-[var(--to-ink-muted)]">Page {(pageIndex + 1).toString()}</div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-9 rounded border bg-transparent px-2 text-sm"
                style={{ borderColor: "var(--to-border)" }}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}/page
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="h-9 rounded border px-3 text-sm font-medium"
                style={{ borderColor: "var(--to-border)" }}
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                disabled={!canPrev || loading}
              >
                Prev
              </button>

              <button
                type="button"
                className="h-9 rounded border px-3 text-sm font-medium"
                style={{ borderColor: "var(--to-border)" }}
                onClick={() => setPageIndex(pageIndex + 1)}
                disabled={!canNext || loading}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <Card variant="subtle" className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Profile editor</div>
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                Edit profile truth here. Permissions and edge grants stay in their own admin surfaces.
              </div>
            </div>
            <Badge variant={selected?.is_admin ? "info" : "neutral"}>{selected?.is_admin ? "Admin" : "Standard"}</Badge>
          </div>

          {!selected ? (
            <div className="mt-4 text-sm text-[var(--to-ink-muted)]">Select a row to edit.</div>
          ) : (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-1">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Email</div>
                <div className="text-sm">{selected.email ?? "—"}</div>
              </div>

              <div className="grid gap-1">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Auth User ID</div>
                <div className="font-mono text-xs break-all text-[var(--to-ink-muted)]">{selected.auth_user_id}</div>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Status</span>
                <select
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value)}
                  className="h-10 rounded-xl border bg-transparent px-3 text-sm"
                  style={{ borderColor: "var(--to-border)" }}
                >
                  {[
                    { value: "pending", label: "pending" },
                    { value: "active", label: "active" },
                    { value: "inactive", label: "inactive" },
                    { value: "disabled", label: "disabled" },
                  ].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2 rounded-xl border p-3" style={{ borderColor: "var(--to-border)" }}>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Person</div>

                <div className="flex flex-wrap gap-2">
                  <div className="min-w-[220px] flex-1">
                    <TextInput
                      value={personSearch}
                      onChange={(e: any) => setPersonSearch(e.target.value)}
                      placeholder="Search person name or email…"
                    />
                  </div>
                  <Button variant="secondary" className="h-10 px-4" onClick={() => void runPersonSearch()} disabled={personLoading}>
                    {personLoading ? "Searching…" : "Search"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-10 px-4"
                    onClick={() => {
                      setPersonIdDraft("");
                      setPersonSearch("");
                      setPersonResults([]);
                    }}
                    disabled={saving}
                  >
                    Clear
                  </Button>
                </div>

                <div className="text-[11px] text-[var(--to-ink-muted)] break-all">Selected person_id: {personIdDraft || "—"}</div>
                <div className="text-[11px] text-[var(--to-ink-muted)]">Current person: {selected.person_full_name ?? "—"}</div>

                {personResults.length > 0 ? (
                  <div className="max-h-48 overflow-auto rounded border" style={{ borderColor: "var(--to-border)" }}>
                    {personResults.map((p) => {
                      const active = personIdDraft === p.person_id;
                      return (
                        <button
                          key={p.person_id}
                          type="button"
                          onClick={() => {
                            setPersonIdDraft(p.person_id);
                            setPersonSearch(p.full_name);
                          }}
                          className={cls(
                            "flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0",
                            active ? "bg-[var(--to-row-hover)]" : "hover:bg-[var(--to-row-hover)]"
                          )}
                          style={{ borderColor: "var(--to-border)" }}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{p.full_name}</div>
                            <div className="truncate text-[11px] text-[var(--to-ink-muted)]">{p.emails ?? "—"}</div>
                            <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">{p.person_id}</div>
                          </div>
                          <Badge variant={p.active ? "success" : "warning"}>{p.active ? "active" : "inactive"}</Badge>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Selected PC-Org</span>
                <select
                  value={selectedPcOrgDraft}
                  onChange={(e) => setSelectedPcOrgDraft(e.target.value)}
                  className="h-10 rounded-xl border bg-transparent px-3 text-sm"
                  style={{ borderColor: "var(--to-border)" }}
                  disabled={pcOrgLoading}
                >
                  <option value="">{pcOrgLoading ? "Loading orgs…" : "— none —"}</option>
                  {pcOrgOptions.map((org) => (
                    <option key={org.pc_org_id} value={org.pc_org_id}>
                      {org.pc_org_name ? `${org.pc_org_name} (${org.pc_org_id.slice(0, 8)})` : org.pc_org_id}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-[var(--to-ink-muted)]">Current org: {selected.selected_pc_org_name ?? "—"}</div>
              </label>

              <label className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--to-border)" }}>
                <input type="checkbox" checked={isAdminDraft} onChange={(e) => setIsAdminDraft(e.target.checked)} />
                <span className="text-sm">App admin</span>
              </label>

              <div className="grid gap-1 rounded-xl border px-3 py-3" style={{ borderColor: "var(--to-border)" }}>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">Audit</div>
                <div className="text-sm text-[var(--to-ink-muted)]">Created: {fmtTs(selected.created_at)}</div>
                <div className="text-sm text-[var(--to-ink-muted)]">Updated: {fmtTs(selected.updated_at)}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button className="h-10 px-4" onClick={() => void onSave()} disabled={saving}>
                  {saving ? "Saving…" : "Save profile"}
                </Button>
                <Button
                  variant="secondary"
                  className="h-10 px-4"
                  onClick={() => {
                    if (!selected) return;
                    setStatusDraft(selected.status ?? "pending");
                    setPersonIdDraft(selected.person_id ?? "");
                    setSelectedPcOrgDraft(selected.selected_pc_org_id ?? "");
                    setIsAdminDraft(selected.is_admin === true);
                    setPersonSearch(selected.person_full_name ?? "");
                    setPersonResults([]);
                  }}
                  disabled={saving}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}