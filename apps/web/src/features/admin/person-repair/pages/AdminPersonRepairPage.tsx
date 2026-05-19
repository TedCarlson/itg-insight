"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageShell, PageHeader } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toolbar } from "@/components/ui/Toolbar";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/DataTable";

type PersonRepairRow = {
  repair_key: string;

  person_id: string;
  full_name: string | null;
  person_status: string | null;
  prospecting_affiliation_id: string | null;

  assignment_id: string | null;
  pc_org_id: string | null;
  pc_org_name: string | null;
  tech_id: string | null;
  position_title: string | null;
  role_type: string | null;

  affiliation_id: string;
  affiliation_code: string | null;
  affiliation: string | null;

  assignment_status: string | null;
  is_active: boolean | null;

  start_date: string | null;
  end_date: string | null;

  reasons: string[];
};

function fmt(value: unknown) {
  const next = String(value ?? "").trim();
  return next || "—";
}

function reasonLabel(reason: string) {
  if (reason === "missing_prospecting_affiliation") return "Missing prospecting affiliation";
  if (reason === "mismatched_prospecting_affiliation") return "Prospecting affiliation mismatch";
  return reason;
}

export function AdminPersonRepairPage() {
  const [rows, setRows] = useState<PersonRepairRow[]>([]);
  const [summary, setSummary] = useState({ pending: 0, shown: 0 });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/admin/person-repair?q=${encodeURIComponent(q)}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }

      setRows((json.rows ?? []) as PersonRepairRow[]);
      setSummary(json.summary ?? { pending: 0, shown: 0 });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load person repair rows");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    return {
      missing: rows.filter((row) => row.reasons.includes("missing_prospecting_affiliation")).length,
      mismatch: rows.filter((row) => row.reasons.includes("mismatched_prospecting_affiliation")).length,
    };
  }, [rows]);

  async function applyAffiliation(row: PersonRepairRow) {
    setSavingKey(row.repair_key);
    setErr(null);

    try {
      const res = await fetch("/api/admin/person-repair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "apply_workforce_affiliation",
          person_id: row.person_id,
          affiliation_id: row.affiliation_id,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Repair failed");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Person Repair"
        subtitle="Bridge repair surface for person rows that block scoped view hydration."
      />

      <Card variant="subtle">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={summary.pending > 0 ? "warning" : "success"}>
            {summary.pending} pending repair
          </Badge>
          <Badge variant="neutral">{summary.shown} shown</Badge>
          <Badge variant="danger">{grouped.missing} missing affiliation</Badge>
          <Badge variant="warning">{grouped.mismatch} mismatch</Badge>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </Card>

      <Card>
        {err ? (
          <Notice variant="danger" title="Person repair error">
            {err}
          </Notice>
        ) : null}

        <div className="mt-3 flex flex-col gap-4">
          <Toolbar
            left={
              <Field label="Search">
                <TextInput
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Name, tech ID, org, affiliation…"
                />
              </Field>
            }
            right={
              <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                Search
              </Button>
            }
          />

          {!loading && rows.length === 0 ? (
            <EmptyState
              title="No person repairs pending"
              message="Scoped hydration records are currently aligned for active workforce rows."
            />
          ) : (
            <DataTable gridClassName="grid-cols-[1.4fr_0.8fr_0.8fr_1fr_1fr_1.1fr_1.1fr_0.8fr]">
              <DataTableHeader>
                <div>Person</div>
                <div>Tech ID</div>
                <div>Org</div>
                <div>Workforce affiliation</div>
                <div>Prospecting affiliation</div>
                <div>Issue</div>
                <div>Role</div>
                <div>Action</div>
              </DataTableHeader>

              <DataTableBody zebra>
                {rows.map((row) => (
                  <DataTableRow key={row.repair_key} hover>
                    <div>
                      <div className="font-medium">{fmt(row.full_name)}</div>
                      <div className="text-xs text-[var(--to-ink-muted)]">{row.person_id}</div>
                    </div>

                    <div>{fmt(row.tech_id)}</div>

                    <div>
                      <div>{fmt(row.pc_org_name)}</div>
                      <div className="text-xs text-[var(--to-ink-muted)]">{fmt(row.pc_org_id)}</div>
                    </div>

                    <div>
                      <div>{fmt(row.affiliation)}</div>
                      <div className="text-xs text-[var(--to-ink-muted)]">
                        {fmt(row.affiliation_code)} • {row.affiliation_id}
                      </div>
                    </div>

                    <div className="text-xs">{fmt(row.prospecting_affiliation_id)}</div>

                    <div className="flex flex-wrap gap-1">
                      {row.reasons.map((reason) => (
                        <Badge key={reason} variant="warning">
                          {reasonLabel(reason)}
                        </Badge>
                      ))}
                    </div>

                    <div>
                      <div>{fmt(row.position_title)}</div>
                      <div className="text-xs text-[var(--to-ink-muted)]">{fmt(row.role_type)}</div>
                    </div>

                    <div>
                      <Button
                        variant="primary"
                        disabled={savingKey === row.repair_key}
                        onClick={() => void applyAffiliation(row)}
                      >
                        {savingKey === row.repair_key ? "Applying…" : "Apply affiliation"}
                      </Button>
                    </div>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </div>
      </Card>
    </PageShell>
  );
}
