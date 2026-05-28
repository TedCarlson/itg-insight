"use client";

import { useCallback, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import type {
  LookupOption,
  PcOrgStateCoverageDraft,
} from "@/features/admin/catalogue/components/forms/PcOrgStateCoverageForm";
import {
  usePcOrgStateCoverageAdmin,
  type PcOrgStateCoverageAdminRow,
} from "@/features/admin/catalogue/hooks/usePcOrgStateCoverageAdmin";
import PcOrgStateCoverageDrawer from "../pc-org-state-coverage/PcOrgStateCoverageDrawer";
import PcOrgStateCoverageRowsTable from "../pc-org-state-coverage/PcOrgStateCoverageRowsTable";
import { fetchPcOrgLookup, fetchStateLookup } from "../pc-org-state-coverage/pcOrgStateCoverageDisplay";

export function PcOrgStateCoverageTableView() {
  const {
    q,
    setQ,
    data,
    loading,
    err,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    refresh,
  } = usePcOrgStateCoverageAdmin({ pageSize: 25 });

  const totalRows = data?.page.totalRows ?? undefined;
  const canPrev = pageIndex > 0;
  const canNext = totalRows == null ? true : (pageIndex + 1) * pageSize < totalRows;

  const rows = useMemo<PcOrgStateCoverageAdminRow[]>(() => data?.rows ?? [], [data?.rows]);

  const summary = useMemo(() => {
    if (loading) return "Loading…";
    if (err) return "Error";
    if (!data) return "";
    if (totalRows != null) return `${totalRows} rows`;
    return `${rows.length} rows`;
  }, [loading, err, data, totalRows, rows.length]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [active, setActive] = useState<PcOrgStateCoverageAdminRow | null>(null);
  const [draft, setDraft] = useState<PcOrgStateCoverageDraft | null>(null);

  const [pcOrgOptions, setPcOrgOptions] = useState<LookupOption[]>([]);
  const [stateOptions, setStateOptions] = useState<LookupOption[]>([]);
  const [lookupsErr, setLookupsErr] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setMode("add");
    setActive(null);
    setDraft(null);
    setLookupsErr(null);
    setSaveErr(null);
    setSaving(false);
  }, []);

  const loadLookups = useCallback(async () => {
    setLookupsErr(null);
    try {
      const [pcOrgs, states] = await Promise.all([fetchPcOrgLookup(), fetchStateLookup()]);
      setPcOrgOptions(pcOrgs);
      setStateOptions(states);
    } catch (error: any) {
      setLookupsErr(error?.message ?? "Failed to load lookups");
      setPcOrgOptions([]);
      setStateOptions([]);
    }
  }, []);

  const onAdd = useCallback(async () => {
    setMode("add");
    setActive(null);
    setDraft({ pc_org_id: null, state_code: null, is_primary: false, coverage_status: "active" });
    setSaveErr(null);
    await loadLookups();
    setOpen(true);
  }, [loadLookups]);

  const onEdit = useCallback(
    async (row: PcOrgStateCoverageAdminRow) => {
      setMode("edit");
      setActive(row);
      setDraft({
        pc_org_id: row.pc_org_id ?? null,
        state_code: row.state_code ?? null,
        is_primary: row.is_primary,
        coverage_status: row.coverage_status,
      });
      setSaveErr(null);
      await loadLookups();
      setOpen(true);
    },
    [loadLookups]
  );

  const canSave = Boolean(draft) && !saving && Boolean(draft?.pc_org_id) && Boolean(draft?.state_code);

  const onSave = useCallback(async () => {
    if (!draft) return;

    setSaving(true);
    setSaveErr(null);

    try {
      if (mode === "add") {
        const res = await fetch("/api/admin/catalogue/pc_org_state_coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });

        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Create failed");
      } else {
        if (!active) throw new Error("Missing active row");

        const res = await fetch(
          `/api/admin/catalogue/pc_org_state_coverage/${encodeURIComponent(active.pc_org_state_coverage_id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
          }
        );

        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Save failed");
      }

      close();
      await refresh();
    } catch (error: any) {
      setSaveErr(error?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }, [active, close, draft, mode, refresh]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">PC-ORG State Coverage</h2>
          <div className="text-xs text-[var(--to-ink-muted)]">
            Table: pc_org_state_coverage • {summary}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[300px]">
            <TextInput
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search PC-ORG, MSO, or State…"
            />
          </div>

          <button
            type="button"
            className="to-btn to-btn--primary inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
            onClick={() => void onAdd()}
            disabled={loading}
          >
            Add coverage
          </button>

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

      <PcOrgStateCoverageRowsTable
        rows={rows}
        loading={loading}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalRows={totalRows}
        canPrev={canPrev}
        canNext={canNext}
        onEdit={(row) => void onEdit(row)}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={setPageSize}
      />

      <PcOrgStateCoverageDrawer
        open={open}
        mode={mode}
        active={active}
        draft={draft}
        saving={saving}
        saveErr={saveErr}
        lookupsErr={lookupsErr}
        canSave={canSave}
        pcOrgOptions={pcOrgOptions}
        stateOptions={stateOptions}
        onClose={close}
        onSave={() => void onSave()}
        onDraftChange={setDraft}
      />
    </div>
  );
}
