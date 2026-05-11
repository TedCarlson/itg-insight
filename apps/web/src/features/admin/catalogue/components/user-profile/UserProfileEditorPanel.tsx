// path: apps/web/src/features/admin/catalogue/components/user-profile/UserProfileEditorPanel.tsx

"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import {
  cls,
  fmtTs,
  type PcOrgOption,
  type PersonSearchRow,
  type UserProfileRow,
} from "./userProfileTypes";

type Props = {
  selected: UserProfileRow | null;
  saving: boolean;
  statusDraft: string;
  corePersonIdDraft: string;
  selectedPcOrgDraft: string;
  isAdminDraft: boolean;
  personSearch: string;
  personResults: PersonSearchRow[];
  personLoading: boolean;
  pcOrgOptions: PcOrgOption[];
  pcOrgLoading: boolean;
  setStatusDraft: (value: string) => void;
  setCorePersonIdDraft: (value: string) => void;
  setSelectedPcOrgDraft: (value: string) => void;
  setIsAdminDraft: (value: boolean) => void;
  setPersonSearch: (value: string) => void;
  setPersonResults: (value: PersonSearchRow[]) => void;
  runPersonSearch: () => void;
  onSave: () => void;
  resetDrafts: () => void;
};

export default function UserProfileEditorPanel({
  selected,
  saving,
  statusDraft,
  corePersonIdDraft,
  selectedPcOrgDraft,
  isAdminDraft,
  personSearch,
  personResults,
  personLoading,
  pcOrgOptions,
  pcOrgLoading,
  setStatusDraft,
  setCorePersonIdDraft,
  setSelectedPcOrgDraft,
  setIsAdminDraft,
  setPersonSearch,
  setPersonResults,
  runPersonSearch,
  onSave,
  resetDrafts,
}: Props) {
  return (
    <Card variant="subtle" className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Profile editor</div>
          <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
            Link auth profiles to core people and selected operating orgs.
            Permissions and edge grants stay in their own admin surfaces.
          </div>
        </div>

        <Badge variant={selected?.is_admin ? "info" : "neutral"}>
          {selected?.is_admin ? "Admin" : "Standard"}
        </Badge>
      </div>

      {!selected ? (
        <div className="mt-4 text-sm text-[var(--to-ink-muted)]">
          Select a row to edit.
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div
            className="grid gap-2 rounded-xl border px-3 py-3"
            style={{ borderColor: "var(--to-border)" }}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              Auth Identity
            </div>
            <div className="grid gap-1">
              <div className="text-[11px] text-[var(--to-ink-muted)]">
                Email
              </div>
              <div className="text-sm">{selected.email ?? "—"}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-[11px] text-[var(--to-ink-muted)]">
                Auth User ID
              </div>
              <div className="break-all font-mono text-xs text-[var(--to-ink-muted)]">
                {selected.auth_user_id}
              </div>
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              Status
            </span>
            <select
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value)}
              className="h-10 rounded-xl border bg-transparent px-3 text-sm"
              style={{ borderColor: "var(--to-border)" }}
            >
              {["pending", "active", "inactive", "disabled"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <div
            className="grid gap-2 rounded-xl border p-3"
            style={{ borderColor: "var(--to-border)" }}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              Core Person Link
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="min-w-[220px] flex-1">
                <TextInput
                  value={personSearch}
                  onChange={(event) => setPersonSearch(event.target.value)}
                  placeholder="Search core person name or email…"
                />
              </div>

              <Button
                variant="secondary"
                className="h-10 px-4"
                onClick={() => runPersonSearch()}
                disabled={personLoading}
              >
                {personLoading ? "Searching…" : "Search"}
              </Button>

              <Button
                variant="secondary"
                className="h-10 px-4"
                onClick={() => {
                  setCorePersonIdDraft("");
                  setPersonSearch("");
                  setPersonResults([]);
                }}
                disabled={saving}
              >
                Clear
              </Button>
            </div>

            <div className="break-all text-[11px] text-[var(--to-ink-muted)]">
              Selected core_person_id: {corePersonIdDraft || "—"}
            </div>

            <div className="text-[11px] text-[var(--to-ink-muted)]">
              Current core person:{" "}
              {selected.core_person_full_name ??
                selected.person_full_name ??
                "—"}
            </div>

            {selected.legacy_person_id ? (
              <div className="break-all text-[11px] text-[var(--to-ink-muted)]">
                Legacy public person_id: {selected.legacy_person_id}
              </div>
            ) : null}

            {personResults.length > 0 ? (
              <div
                className="max-h-48 overflow-auto rounded border"
                style={{ borderColor: "var(--to-border)" }}
              >
                {personResults.map((person) => {
                  const active = corePersonIdDraft === person.person_id;

                  return (
                    <button
                      key={person.person_id}
                      type="button"
                      onClick={() => {
                        setCorePersonIdDraft(person.person_id);
                        setPersonSearch(person.full_name);
                      }}
                      className={cls(
                        "flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0",
                        active
                          ? "bg-[var(--to-row-hover)]"
                          : "hover:bg-[var(--to-row-hover)]"
                      )}
                      style={{ borderColor: "var(--to-border)" }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {person.full_name}
                        </div>
                        <div className="truncate text-[11px] text-[var(--to-ink-muted)]">
                          {person.emails ?? "—"}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">
                          {person.person_id}
                        </div>
                        <div className="text-[11px] text-[var(--to-ink-muted)]">
                          {[person.role, person.co_code].filter(Boolean).join(" • ") ||
                            "—"}
                        </div>
                      </div>

                      <Badge variant={person.active ? "success" : "warning"}>
                        {person.active ? "active" : "inactive"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              Selected PC-Org
            </span>
            <select
              value={selectedPcOrgDraft}
              onChange={(event) => setSelectedPcOrgDraft(event.target.value)}
              className="h-10 rounded-xl border bg-transparent px-3 text-sm"
              style={{ borderColor: "var(--to-border)" }}
              disabled={pcOrgLoading}
            >
              <option value="">
                {pcOrgLoading ? "Loading orgs…" : "— none —"}
              </option>
              {pcOrgOptions.map((org) => (
                <option key={org.pc_org_id} value={org.pc_org_id}>
                  {org.pc_org_name
                    ? `${org.pc_org_name} (${org.pc_org_id.slice(0, 8)})`
                    : org.pc_org_id}
                </option>
              ))}
            </select>

            <div className="text-[11px] text-[var(--to-ink-muted)]">
              Current org: {selected.selected_pc_org_name ?? "—"}
            </div>
          </label>

          <label
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: "var(--to-border)" }}
          >
            <input
              type="checkbox"
              checked={isAdminDraft}
              onChange={(event) => setIsAdminDraft(event.target.checked)}
            />
            <span className="text-sm">App admin</span>
          </label>

          <div
            className="grid gap-1 rounded-xl border px-3 py-3"
            style={{ borderColor: "var(--to-border)" }}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              Audit
            </div>
            <div className="text-sm text-[var(--to-ink-muted)]">
              Created: {fmtTs(selected.created_at)}
            </div>
            <div className="text-sm text-[var(--to-ink-muted)]">
              Updated: {fmtTs(selected.updated_at)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="h-10 px-4"
              onClick={() => onSave()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save profile"}
            </Button>

            <Button
              variant="secondary"
              className="h-10 px-4"
              onClick={resetDrafts}
              disabled={saving}
            >
              Reset
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}