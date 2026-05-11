// path: apps/web/src/features/admin/catalogue/components/pc-org/PcOrgDrawer.tsx

"use client";

import { RecordDrawer } from "@/features/admin/catalogue/components/RecordDrawer";
import {
  PcOrgForm,
  type LookupOption,
  type PcOrgDraft,
} from "@/features/admin/catalogue/components/forms/PcOrgForm";
import type { PcOrgAdminRow } from "@/features/admin/catalogue/hooks/usePcOrgAdmin";
import { shortId } from "./pcOrgDisplay";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  active: PcOrgAdminRow | null;
  draft: PcOrgDraft | null;
  saving: boolean;
  saveErr: string | null;
  canSave: boolean;
  pcOptions: LookupOption[];
  msoOptions: LookupOption[];
  divisionOptions: LookupOption[];
  regionOptions: LookupOption[];
  onClose: () => void;
  onSave: () => void;
  onDraftChange: (next: PcOrgDraft) => void;
};

export default function PcOrgDrawer({
  open,
  mode,
  active,
  draft,
  saving,
  saveErr,
  canSave,
  pcOptions,
  msoOptions,
  divisionOptions,
  regionOptions,
  onClose,
  onSave,
  onDraftChange,
}: Props) {
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={
        mode === "create"
          ? "Add PC-ORG"
          : active
            ? `Edit PC-ORG • ${active.pc_org_name ?? shortId(active.pc_org_id)}`
            : "Edit PC-ORG"
      }
      subtitle={
        mode === "edit" && active ? `UUID: ${active.pc_org_id}` : undefined
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <div
            className="min-h-[20px] text-sm"
            style={{ color: "var(--to-danger)" }}
          >
            {saveErr ?? ""}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 rounded border px-3 text-sm font-medium"
              style={{ borderColor: "var(--to-border)" }}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              className="to-btn inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: "var(--to-border)" }}
              onClick={onSave}
              disabled={!canSave}
            >
              {saving
                ? "Saving…"
                : mode === "create"
                  ? "Create"
                  : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {draft ? (
        <PcOrgForm
          value={draft}
          onChange={onDraftChange}
          pcOptions={pcOptions}
          msoOptions={msoOptions}
          divisionOptions={divisionOptions}
          regionOptions={regionOptions}
        />
      ) : null}
    </RecordDrawer>
  );
}