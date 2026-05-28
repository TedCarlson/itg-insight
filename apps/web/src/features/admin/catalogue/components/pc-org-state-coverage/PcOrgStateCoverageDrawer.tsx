"use client";

import { RecordDrawer } from "@/features/admin/catalogue/components/RecordDrawer";
import {
  PcOrgStateCoverageForm,
  type LookupOption,
  type PcOrgStateCoverageDraft,
} from "@/features/admin/catalogue/components/forms/PcOrgStateCoverageForm";
import type { PcOrgStateCoverageAdminRow } from "@/features/admin/catalogue/hooks/usePcOrgStateCoverageAdmin";
import { labelOrId } from "./pcOrgStateCoverageDisplay";

type Props = {
  open: boolean;
  mode: "add" | "edit";
  active: PcOrgStateCoverageAdminRow | null;
  draft: PcOrgStateCoverageDraft | null;
  saving: boolean;
  saveErr: string | null;
  lookupsErr: string | null;
  canSave: boolean;
  pcOrgOptions: LookupOption[];
  stateOptions: LookupOption[];
  onClose: () => void;
  onSave: () => void;
  onDraftChange: (next: PcOrgStateCoverageDraft) => void;
};

export default function PcOrgStateCoverageDrawer({
  open,
  mode,
  active,
  draft,
  saving,
  saveErr,
  lookupsErr,
  canSave,
  pcOrgOptions,
  stateOptions,
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
          ? "Add PC-ORG State Coverage"
          : active
            ? `Edit coverage • ${labelOrId(active.pc_org_name, active.pc_org_id)}`
            : "Edit coverage"
      }
      subtitle={
        mode === "edit" && active
          ? `UUID: ${active.pc_org_state_coverage_id}`
          : "This creates a Locate state coverage row."
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="min-h-[20px] text-sm" style={{ color: "var(--to-danger)" }}>
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
              title={!draft?.pc_org_id || !draft?.state_code ? "Select both PC-ORG and State" : undefined}
            >
              {saving ? "Saving…" : mode === "add" ? "Create coverage" : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {draft ? (
        <PcOrgStateCoverageForm
          value={draft}
          onChange={onDraftChange}
          pcOrgOptions={pcOrgOptions}
          stateOptions={stateOptions}
        />
      ) : null}
    </RecordDrawer>
  );
}
