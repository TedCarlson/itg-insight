// path: apps/web/src/features/admin/catalogue/components/views/PcOrgTableView.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { useCatalogueLookups } from "@/features/admin/catalogue/components/lookups/useCatalogueLookups";
import {
  PcOrgForm,
  type LookupOption,
  type PcOrgDraft,
} from "@/features/admin/catalogue/components/forms/PcOrgForm";
import {
  usePcOrgAdmin,
  type PcOrgAdminRow,
} from "@/features/admin/catalogue/hooks/usePcOrgAdmin";
import PcOrgDrawer from "../pc-org/PcOrgDrawer";
import PcOrgRowsTable from "../pc-org/PcOrgRowsTable";
import { buildOptionsFromRows } from "../pc-org/pcOrgDisplay";

function emptyDraft(): PcOrgDraft {
  return {
    pc_org_name: "",
    fulfillment_center_id: null,
    fulfillment_center_name: "",
    pc_id: null,
    mso_id: null,
    division_id: null,
    region_id: null,
    state_code: null,
  };
}

export function PcOrgTableView() {
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
  } = usePcOrgAdmin({ pageSize: 25 });

  const totalRows = data?.page.totalRows ?? undefined;
  const canPrev = pageIndex > 0;
  const canNext =
    totalRows == null ? true : (pageIndex + 1) * pageSize < totalRows;

  const rows = useMemo<PcOrgAdminRow[]>(() => data?.rows ?? [], [data?.rows]);

  const summary = useMemo(() => {
    if (loading) return "Loading…";
    if (err) return "Error";
    if (!data) return "";
    if (totalRows != null) return `${totalRows} rows`;

    return `${rows.length} rows`;
  }, [loading, err, data, totalRows, rows.length]);

  const { data: lookups, error: lookupsErr } = useCatalogueLookups("pc_org");
  const fallback = useMemo(() => buildOptionsFromRows(rows), [rows]);

  const pcOptions =
    ((lookups as any)?.pc as LookupOption[] | undefined) ?? fallback.pcOptions;
  const msoOptions =
    ((lookups as any)?.mso as LookupOption[] | undefined) ??
    fallback.msoOptions;
  const divisionOptions =
    ((lookups as any)?.division as LookupOption[] | undefined) ??
    fallback.divisionOptions;
  const regionOptions =
    ((lookups as any)?.region as LookupOption[] | undefined) ??
    fallback.regionOptions;
  const stateOptions =
    ((lookups as any)?.state as LookupOption[] | undefined) ?? [];

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("edit");
  const [active, setActive] = useState<PcOrgAdminRow | null>(null);
  const [draft, setDraft] = useState<PcOrgDraft | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setMode("edit");
    setActive(null);
    setDraft(null);
    setSaveErr(null);
    setSaving(false);
  }, []);

  const onCreate = useCallback(() => {
    setMode("create");
    setActive(null);
    setDraft(emptyDraft());
    setSaveErr(null);
    setSaving(false);
    setOpen(true);
  }, []);

  const onEdit = useCallback((row: PcOrgAdminRow) => {
    setMode("edit");
    setActive(row);
    setDraft({
      pc_org_name: row.pc_org_name ?? "",
      fulfillment_center_id: row.fulfillment_center_id ?? null,
      fulfillment_center_name: row.fulfillment_center_name ?? "",
      pc_id: row.pc_id ?? null,
      mso_id: row.mso_id ?? null,
      division_id: row.division_id ?? null,
      region_id: row.region_id ?? null,
      state_code: row.state_code ?? null,
    });
    setSaveErr(null);
    setSaving(false);
    setOpen(true);
  }, []);

  const canSave = Boolean(draft) && !saving;

  const onSave = useCallback(async () => {
    if (!draft) return;

    setSaving(true);
    setSaveErr(null);

    try {
      const url =
        mode === "create"
          ? "/api/admin/catalogue/pc_org"
          : `/api/admin/catalogue/pc_org/${encodeURIComponent(
              active!.pc_org_id
            )}`;

      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      const json = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? "Save failed");
      }

      close();
      await refresh();
    } catch (error: any) {
      setSaveErr(error?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, mode, active, close, refresh]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">PC-ORG</h2>
          <div className="text-xs text-[var(--to-ink-muted)]">
            Table: pc_org • {summary}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[280px]">
            <TextInput
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search PC-ORG or FC…"
            />
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

          <button
            type="button"
            className="to-btn inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
            onClick={onCreate}
            disabled={loading}
          >
            Add PC-ORG
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

      {lookupsErr ? (
        <Card variant="subtle" className="p-3">
          <div className="text-sm" style={{ color: "var(--to-ink-muted)" }}>
            Lookups error: {lookupsErr} (dropdowns may be incomplete)
          </div>
        </Card>
      ) : null}

      <PcOrgRowsTable
        rows={rows}
        loading={loading}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalRows={totalRows}
        canPrev={canPrev}
        canNext={canNext}
        onEdit={onEdit}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={setPageSize}
      />

      <PcOrgDrawer
        open={open}
        mode={mode}
        active={active}
        draft={draft}
        saving={saving}
        saveErr={saveErr}
        canSave={canSave}
        pcOptions={pcOptions}
        msoOptions={msoOptions}
        divisionOptions={divisionOptions}
        regionOptions={regionOptions}
        stateOptions={stateOptions}
        onClose={close}
        onSave={() => void onSave()}
        onDraftChange={setDraft}
      />
    </div>
  );
}