// path: apps/web/src/features/admin/catalogue/components/views/PcOrgOfficeTableView.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import type {
  LookupOption,
  PcOrgOfficeDraft,
} from "@/features/admin/catalogue/components/forms/PcOrgOfficeForm";
import {
  usePcOrgOfficeAdmin,
  type PcOrgOfficeAdminRow,
} from "@/features/admin/catalogue/hooks/usePcOrgOfficeAdmin";
import PcOrgOfficeDrawer from "../pc-org-office/PcOrgOfficeDrawer";
import PcOrgOfficeRowsTable from "../pc-org-office/PcOrgOfficeRowsTable";
import { fetchLookup } from "../pc-org-office/pcOrgOfficeDisplay";

export function PcOrgOfficeTableView() {
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
  } = usePcOrgOfficeAdmin({ pageSize: 25 });

  const totalRows = data?.page.totalRows ?? undefined;
  const canPrev = pageIndex > 0;
  const canNext =
    totalRows == null ? true : (pageIndex + 1) * pageSize < totalRows;

  const rows = useMemo<PcOrgOfficeAdminRow[]>(
    () => data?.rows ?? [],
    [data?.rows]
  );

  const summary = useMemo(() => {
    if (loading) return "Loading…";
    if (err) return "Error";
    if (!data) return "";
    if (totalRows != null) return `${totalRows} rows`;

    return `${rows.length} rows`;
  }, [loading, err, data, totalRows, rows.length]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [active, setActive] = useState<PcOrgOfficeAdminRow | null>(null);
  const [draft, setDraft] = useState<PcOrgOfficeDraft | null>(null);

  const [pcOrgOptions, setPcOrgOptions] = useState<LookupOption[]>([]);
  const [officeOptions, setOfficeOptions] = useState<LookupOption[]>([]);
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
      const [pcs, offices] = await Promise.all([
        fetchLookup("pc_org"),
        fetchLookup("office"),
      ]);

      setPcOrgOptions(pcs);
      setOfficeOptions(offices);
    } catch (error: any) {
      setLookupsErr(error?.message ?? "Failed to load lookups");
      setPcOrgOptions([]);
      setOfficeOptions([]);
    }
  }, []);

  const onAdd = useCallback(async () => {
    setMode("add");
    setActive(null);
    setDraft({ pc_org_id: null, office_id: null });
    setSaveErr(null);
    await loadLookups();
    setOpen(true);
  }, [loadLookups]);

  const onEdit = useCallback(
    async (row: PcOrgOfficeAdminRow) => {
      setMode("edit");
      setActive(row);
      setDraft({
        pc_org_id: row.pc_org_id ?? null,
        office_id: row.office_id ?? null,
      });
      setSaveErr(null);
      await loadLookups();
      setOpen(true);
    },
    [loadLookups]
  );

  const canSave =
    Boolean(draft) && !saving && Boolean(draft?.pc_org_id) && Boolean(draft?.office_id);

  const onSave = useCallback(async () => {
    if (!draft) return;

    setSaving(true);
    setSaveErr(null);

    try {
      if (mode === "add") {
        const res = await fetch("/api/admin/catalogue/pc_org_office", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });

        const json = (await res.json()) as { ok?: boolean; error?: string };

        if (!res.ok) {
          throw new Error(json.error ?? "Create failed");
        }
      } else {
        if (!active) throw new Error("Missing active row");

        const res = await fetch(
          `/api/admin/catalogue/pc_org_office/${encodeURIComponent(
            active.pc_org_office_id
          )}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
          }
        );

        const json = (await res.json()) as { ok?: boolean; error?: string };

        if (!res.ok) {
          throw new Error(json.error ?? "Save failed");
        }
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
          <h2 className="text-lg font-semibold">PC-ORG ↔ Office</h2>
          <div className="text-xs text-[var(--to-ink-muted)]">
            Table: pc_org_office • {summary}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[300px]">
            <TextInput
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search PC-ORG or Office…"
            />
          </div>

          <button
            type="button"
            className="to-btn to-btn--primary inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
            onClick={() => void onAdd()}
            disabled={loading}
          >
            Add link
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

      <PcOrgOfficeRowsTable
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

      <PcOrgOfficeDrawer
        open={open}
        mode={mode}
        active={active}
        draft={draft}
        saving={saving}
        saveErr={saveErr}
        lookupsErr={lookupsErr}
        canSave={canSave}
        pcOrgOptions={pcOrgOptions}
        officeOptions={officeOptions}
        onClose={close}
        onSave={() => void onSave()}
        onDraftChange={setDraft}
      />
    </div>
  );
}