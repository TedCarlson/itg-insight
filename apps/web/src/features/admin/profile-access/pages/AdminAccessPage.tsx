"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageShell, PageHeader } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toolbar } from "@/components/ui/Toolbar";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/DataTable";

type OrgAccessRow = {
  pc_org_id: string;
  pc_org_name: string | null;
  created_at: string | null;
  is_selected: boolean;
};

type PermissionRow = {
  pc_org_id: string;
  pc_org_name: string | null;
  permission_key: string;
};

type AccessRow = {
  auth_user_id: string;
  email: string | null;
  invited_at: string | null;
  last_sign_in_at: string | null;
  profile_status: string | null;
  selected_pc_org_id: string | null;
  selected_pc_org_name: string | null;
  is_admin: boolean;
  person_id: string | null;
  person_full_name: string | null;
  person_email: string | null;
  person_active: boolean | null;
  org_access: OrgAccessRow[];
  org_access_count: number;
  permissions: PermissionRow[];
};

type PcOrgOption = {
  pc_org_id: string;
  pc_org_name: string | null;
};

type ScopeFilter = "all" | "multi_org" | "active" | "admins";

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function DetailLine(props: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
        {props.label}
      </div>
      <div className="break-words text-sm text-[var(--to-ink)]">{props.value || "—"}</div>
    </div>
  );
}

function SectionTitle(props: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-[var(--to-ink)]">{props.children}</div>;
}

export function AdminAccessPage() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [pcOrgs, setPcOrgs] = useState<PcOrgOption[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [selected, setSelected] = useState<AccessRow | null>(null);
  const [orgToAdd, setOrgToAdd] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/admin/profile-access?q=${encodeURIComponent(q)}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }

      const nextRows = (json.rows ?? []) as AccessRow[];
      setRows(nextRows);
      setPcOrgs((json.pc_orgs ?? []) as PcOrgOption[]);
      setPermissionKeys((json.permission_keys ?? []) as string[]);

      setSelected((current) => {
        if (!current) return null;
        return nextRows.find((r) => r.auth_user_id === current.auth_user_id) ?? null;
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load profile access");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      admins: rows.filter((r) => r.is_admin).length,
      multiOrg: rows.filter((r) => r.org_access_count > 1).length,
      active: rows.filter((r) => !!r.last_sign_in_at).length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (scopeFilter === "multi_org") return rows.filter((r) => r.org_access_count > 1);
    if (scopeFilter === "active") return rows.filter((r) => !!r.last_sign_in_at);
    if (scopeFilter === "admins") return rows.filter((r) => r.is_admin);
    return rows;
  }, [rows, scopeFilter]);

  function toggleScopeFilter(next: ScopeFilter) {
    setScopeFilter((current) => (current === next ? "all" : next));
  }

  const selectedEligibleIds = useMemo(() => {
    return new Set((selected?.org_access ?? []).map((o) => o.pc_org_id));
  }, [selected]);

  const orgOptionsToAdd = useMemo(() => {
    return pcOrgs.filter((o) => !selectedEligibleIds.has(o.pc_org_id));
  }, [pcOrgs, selectedEligibleIds]);

  async function mutate(body: Record<string, unknown>) {
    setSaving(true);
    setErr(null);

    try {
      const res = await fetch("/api/admin/profile-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }

      setOrgToAdd("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function hasPermission(pcOrgId: string, permissionKey: string) {
    return (selected?.permissions ?? []).some(
      (p) => p.pc_org_id === pcOrgId && p.permission_key === permissionKey,
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Profile Access Editor"
        subtitle="Manage org eligibility, selected org context, and scoped permissions."
      />

      <Card variant="subtle">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleScopeFilter("all")}
            className={scopeFilter === "all" ? "rounded-full ring-2 ring-[var(--to-focus)]" : "rounded-full"}
            aria-pressed={scopeFilter === "all"}
          >
            <Badge variant="neutral">{summary.total} profiles</Badge>
          </button>

          <button
            type="button"
            onClick={() => toggleScopeFilter("multi_org")}
            className={scopeFilter === "multi_org" ? "rounded-full ring-2 ring-[var(--to-focus)]" : "rounded-full"}
            aria-pressed={scopeFilter === "multi_org"}
          >
            <Badge variant="info">{summary.multiOrg} multi-org</Badge>
          </button>

          <button
            type="button"
            onClick={() => toggleScopeFilter("active")}
            className={scopeFilter === "active" ? "rounded-full ring-2 ring-[var(--to-focus)]" : "rounded-full"}
            aria-pressed={scopeFilter === "active"}
          >
            <Badge variant="success">{summary.active} active</Badge>
          </button>

          <button
            type="button"
            onClick={() => toggleScopeFilter("admins")}
            className={scopeFilter === "admins" ? "rounded-full ring-2 ring-[var(--to-focus)]" : "rounded-full"}
            aria-pressed={scopeFilter === "admins"}
          >
            <Badge variant="warning">{summary.admins} admins</Badge>
          </button>

          {scopeFilter !== "all" ? (
            <Button variant="ghost" onClick={() => setScopeFilter("all")}>
              Clear filter
            </Button>
          ) : null}

          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </Card>

      <Card>
        {err ? (
          <Notice variant="danger" title="Failed to load profile access">
            {err}
          </Notice>
        ) : (
          <div className="flex flex-col gap-4">
            <Toolbar
              left={
                <Field label="Search">
                  <TextInput
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Name, email, org, or auth user id…"
                  />
                </Field>
              }
              right={
                <div className="text-sm text-[var(--to-ink-muted)]">
                  Showing <span className="font-medium text-[var(--to-ink)]">{visibleRows.length}</span> of{" "}
                  <span className="font-medium text-[var(--to-ink)]">{rows.length}</span>
                </div>
              }
            />

            {loading ? (
              <div className="text-sm text-[var(--to-ink-muted)]">Loading…</div>
            ) : visibleRows.length === 0 ? (
              <EmptyState title="No profiles" message="No matching profiles were found." />
            ) : (
              <DataTable zebra hover layout="fixed">
                <DataTableHeader>
                  <div className="col-span-4">Profile</div>
                  <div className="col-span-3">Selected Org</div>
                  <div className="col-span-3">Org Access</div>
                  <div className="col-span-2 text-right">State</div>
                </DataTableHeader>

                <DataTableBody zebra>
                  {visibleRows.map((r) => (
                    <DataTableRow
                      key={r.auth_user_id}
                      className="cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <div className="col-span-4 flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-[var(--to-ink)]">
                            {r.person_full_name ?? r.email ?? "—"}
                          </div>

                          {r.is_admin ? <Badge variant="warning">Admin</Badge> : null}
                          {r.person_active === false ? (
                            <Badge variant="danger">Person inactive</Badge>
                          ) : null}
                        </div>

                        <div className="text-xs text-[var(--to-ink-muted)]">
                          {r.email ?? "—"}
                          {r.person_email ? (
                            <>
                              <span className="mx-1">•</span>
                              person: {r.person_email}
                            </>
                          ) : null}
                          <span className="mx-1">•</span>
                          {r.auth_user_id}
                        </div>
                      </div>

                      <div className="col-span-3 flex flex-col gap-1">
                        <div className="font-medium">{r.selected_pc_org_name ?? "—"}</div>
                        <div className="text-xs text-[var(--to-ink-muted)]">
                          {r.selected_pc_org_id ?? "No selected org"}
                        </div>
                      </div>

                      <div className="col-span-3 flex flex-wrap gap-2">
                        {r.org_access.length === 0 ? (
                          <Badge variant="neutral">No org access</Badge>
                        ) : (
                          r.org_access.map((o) => (
                            <Badge
                              key={`${r.auth_user_id}:${o.pc_org_id}`}
                              variant={o.is_selected ? "success" : "info"}
                            >
                              {o.pc_org_name ?? o.pc_org_id}
                            </Badge>
                          ))
                        )}
                      </div>

                      <div className="col-span-2 flex flex-col items-end gap-1">
                        <Badge variant={r.last_sign_in_at ? "success" : "neutral"}>
                          {r.last_sign_in_at ? "Active" : "Never signed in"}
                        </Badge>

                        <div className="text-right text-xs text-[var(--to-ink-muted)]">
                          invited: {fmtDate(r.invited_at)}
                          <br />
                          last: {fmtDate(r.last_sign_in_at)}
                        </div>
                      </div>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}

            <Notice variant="info" title="Next step">
              Click a profile row to inspect identity, org access, and scoped permissions. Mutation controls come next.
            </Notice>
          </div>
        )}
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.person_full_name ?? selected?.email ?? "Profile access"}
        subtitle="Profile editor preview"
        widthClass="w-[680px]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="flex flex-col gap-6">
            <section className="grid gap-3">
              <SectionTitle>Identity</SectionTitle>
              <div className="grid gap-3 rounded-xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-4 md:grid-cols-2">
                <DetailLine label="Auth email" value={selected.email} />
                <DetailLine label="Auth user ID" value={selected.auth_user_id} />
                <DetailLine label="Profile status" value={selected.profile_status} />
                <DetailLine label="Admin" value={selected.is_admin ? "Yes" : "No"} />
                <DetailLine label="Person" value={selected.person_full_name} />
                <DetailLine label="Person email" value={selected.person_email} />
              </div>
            </section>

            <section className="grid gap-3">
              <SectionTitle>Selected org context</SectionTitle>
              <div className="rounded-xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-4">
                <DetailLine label="Selected org" value={selected.selected_pc_org_name} />
                <div className="mt-3">
                  <DetailLine label="Selected org ID" value={selected.selected_pc_org_id} />
                </div>
              </div>
            </section>

            <section className="grid gap-3">
              <SectionTitle>Org access</SectionTitle>

              <div className="flex gap-2">
                <Select
                  value={orgToAdd}
                  onChange={(e) => setOrgToAdd(e.target.value)}
                  disabled={saving || orgOptionsToAdd.length === 0}
                >
                  <option value="">Add org access…</option>
                  {orgOptionsToAdd.map((o) => (
                    <option key={o.pc_org_id} value={o.pc_org_id}>
                      {o.pc_org_name ?? o.pc_org_id}
                    </option>
                  ))}
                </Select>

                <Button
                  variant="secondary"
                  disabled={!orgToAdd || saving}
                  onClick={() =>
                    void mutate({
                      action: "grant_org_access",
                      auth_user_id: selected.auth_user_id,
                      pc_org_id: orgToAdd,
                    })
                  }
                >
                  Add
                </Button>
              </div>

              <div className="grid gap-2">
                {selected.org_access.length === 0 ? (
                  <div className="rounded-xl border border-[var(--to-border)] p-4 text-sm text-[var(--to-ink-muted)]">
                    No org eligibility rows exist for this profile.
                  </div>
                ) : (
                  selected.org_access.map((o) => (
                    <div
                      key={o.pc_org_id}
                      className="grid gap-3 rounded-xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{o.pc_org_name ?? o.pc_org_id}</div>
                          <div className="text-xs text-[var(--to-ink-muted)]">
                            {o.pc_org_id} • added {fmtDate(o.created_at)}
                          </div>
                        </div>

                        {o.is_selected ? (
                          <Badge variant="success">Selected</Badge>
                        ) : (
                          <Badge variant="info">Eligible</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!o.is_selected ? (
                          <Button
                            variant="secondary"
                            disabled={saving}
                            onClick={() =>
                              void mutate({
                                action: "set_selected_org",
                                auth_user_id: selected.auth_user_id,
                                pc_org_id: o.pc_org_id,
                              })
                            }
                          >
                            Set selected
                          </Button>
                        ) : null}

                        <Button
                          variant="ghost"
                          disabled={saving}
                          onClick={() =>
                            void mutate({
                              action: "revoke_org_access",
                              auth_user_id: selected.auth_user_id,
                              pc_org_id: o.pc_org_id,
                            })
                          }
                        >
                          Revoke access
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="grid gap-3">
              <SectionTitle>Scoped permissions</SectionTitle>

              {selected.org_access.length === 0 ? (
                <div className="rounded-xl border border-[var(--to-border)] p-4 text-sm text-[var(--to-ink-muted)]">
                  Add org access before assigning scoped permissions.
                </div>
              ) : (
                <div className="grid gap-3">
                  {selected.org_access.map((org) => (
                    <div
                      key={`permissions:${org.pc_org_id}`}
                      className="grid gap-3 rounded-xl border border-[var(--to-border)] bg-[var(--to-surface-2)] p-3"
                    >
                      <div className="font-medium">{org.pc_org_name ?? org.pc_org_id}</div>

                      <div className="flex flex-wrap gap-2">
                        {permissionKeys.map((permissionKey) => {
                          const enabled = hasPermission(org.pc_org_id, permissionKey);

                          return (
                            <Button
                              key={`${org.pc_org_id}:${permissionKey}`}
                              variant={enabled ? "secondary" : "ghost"}
                              disabled={saving}
                              onClick={() =>
                                void mutate({
                                  action: "toggle_permission",
                                  auth_user_id: selected.auth_user_id,
                                  pc_org_id: org.pc_org_id,
                                  permission_key: permissionKey,
                                  enabled: !enabled,
                                })
                              }
                            >
                              {enabled ? "✓ " : ""}
                              {permissionKey}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </Drawer>
    </PageShell>
  );
}
