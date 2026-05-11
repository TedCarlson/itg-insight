// path: apps/web/src/features/admin/catalogue/components/pc-org-office/PcOrgOfficeDrawer.tsx

"use client";

import { RecordDrawer } from "@/features/admin/catalogue/components/RecordDrawer";
import {
  PcOrgOfficeForm,
  type LookupOption,
  type PcOrgOfficeDraft,
} from "@/features/admin/catalogue/components/forms/PcOrgOfficeForm";
import type { PcOrgOfficeAdminRow } from "@/features/admin/catalogue/hooks/usePcOrgOfficeAdmin";
import { labelOrId } from "./pcOrgOfficeDisplay";

type Props = {
  open: boolean;
  mode: "add" | "edit";
  active: PcOrgOfficeAdminRow | null;
  draft: PcOrgOfficeDraft | null;
  saving: boolean;
  saveErr: string | null;
  lookupsErr: string | null;
  canSave: boolean;
  pcOrgOptions: LookupOption[];
  officeOptions: LookupOption[];
  onClose: () => void;
  onSave: () => void;
  onDraftChange: (next: PcOrgOfficeDraft) => void;
};

export default function PcOrgOfficeDrawer({
  open,
  mode,
  active,
  draft,
  saving,
  saveErr,
  lookupsErr,
  canSave,
  pcOrgOptions,
  officeOptions,
  onClose,
  onSave,
  onDraftChange,
}: Props) {
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={
        mode === "add"
          ? "Add PC-ORG ↔ Office link"
          : active
            ? `Edit link • ${labelOrId(active.pc_org_name, active.pc_org_id)}`
            : "Edit link"
      }
      subtitle={
        mode === "edit" && active
          ? `UUID: ${active.pc_org_office_id}`
          : "This creates a relationship link row."
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <div
            className="min-h-[20px] text-sm"
            style={{ color: "var(--to-danger)" }}
          >
            {saveErr ?? lookupsErr ?? ""}
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
              title={
                !draft?.pc_org_id || !draft?.office_id
                  ? "Select both PC-ORG and Office"
                  : undefined
              }
            >
              {saving
                ? "Saving…"
                : mode === "add"
                  ? "Create link"
                  : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {draft ? (
        <PcOrgOfficeForm
          value={draft}
          onChange={onDraftChange}
          pcOrgOptions={pcOrgOptions}
          officeOptions={officeOptions}
        />
      ) : null}
    </RecordDrawer>
  );
}