// path: apps/web/src/features/admin/catalogue/components/views/UserProfileTableView.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { useUserProfileAdmin } from "../../hooks/useUserProfileAdmin";
import UserProfileEditorPanel from "../user-profile/UserProfileEditorPanel";
import UserProfileRowsTable from "../user-profile/UserProfileRowsTable";
import type {
  PcOrgOption,
  PersonSearchRow,
  UserProfileRow,
} from "../user-profile/userProfileTypes";

export function UserProfileTableView() {
  const toast = useToast();

  const {
    q,
    setQ,
    data,
    loading,
    saving,
    err,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    refresh,
    saveProfile,
  } = useUserProfileAdmin({ pageSize: 25 });

  const rows = useMemo(
    () => ((data?.rows ?? []) as UserProfileRow[]),
    [data]
  );

  const totalRows = data?.page.totalRows ?? 0;
  const canPrev = pageIndex > 0;
  const canNext = (pageIndex + 1) * pageSize < totalRows;

  const [selectedAuthUserId, setSelectedAuthUserId] = useState<string | null>(
    null
  );

  const selected = useMemo(
    () =>
      rows.find((row) => row.auth_user_id === selectedAuthUserId) ??
      rows[0] ??
      null,
    [rows, selectedAuthUserId]
  );

  const [statusDraft, setStatusDraft] = useState("pending");
  const [corePersonIdDraft, setCorePersonIdDraft] = useState("");
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
    setCorePersonIdDraft(selected.core_person_id ?? selected.person_id ?? "");
    setSelectedPcOrgDraft(selected.selected_pc_org_id ?? "");
    setIsAdminDraft(selected.is_admin === true);
    setPersonSearch(
      selected.core_person_full_name ?? selected.person_full_name ?? ""
    );
    setPersonResults([]);
  }, [selected]);

  useEffect(() => {
    let cancelled = false;

    async function loadPcOrgs() {
      setPcOrgLoading(true);

      try {
        const res = await fetch("/api/admin/catalogue/user_profile/lookups", {
          method: "GET",
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load orgs");
        }

        if (!cancelled) {
          setPcOrgOptions(Array.isArray(json?.orgs) ? json.orgs : []);
        }
      } catch (error: any) {
        if (!cancelled) {
          setPcOrgOptions([]);
          toast.push({
            title: "User Profile",
            message: error?.message ?? "Failed to load org list",
            variant: "danger",
          });
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
      const params = new URLSearchParams();

      if (personSearch.trim()) {
        params.set("q", personSearch.trim());
      }

      const res = await fetch(
        `/api/admin/catalogue/user_profile/person-search?${params.toString()}`,
        { method: "GET" }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to search person");
      }

      setPersonResults(Array.isArray(json?.rows) ? json.rows : []);
    } catch (error: any) {
      setPersonResults([]);

      toast.push({
        title: "User Profile",
        message: error?.message ?? "Failed to search person",
        variant: "danger",
      });
    } finally {
      setPersonLoading(false);
    }
  }

  async function onSave() {
    if (!selected) return;

    const result = await saveProfile({
      auth_user_id: selected.auth_user_id,
      status: statusDraft,
      core_person_id: corePersonIdDraft.trim() || null,
      selected_pc_org_id: selectedPcOrgDraft.trim() || null,
      is_admin: isAdminDraft,
    });

    if (!result.ok) {
      toast.push({
        title: "User Profile",
        message: result.error ?? "Save failed",
        variant: "danger",
      });

      return;
    }

    toast.push({
      title: "User Profile",
      message: "Profile saved.",
      variant: "success",
    });
  }

  function resetDrafts() {
    if (!selected) return;

    setStatusDraft(selected.status ?? "pending");
    setCorePersonIdDraft(selected.core_person_id ?? selected.person_id ?? "");
    setSelectedPcOrgDraft(selected.selected_pc_org_id ?? "");
    setIsAdminDraft(selected.is_admin === true);
    setPersonSearch(
      selected.core_person_full_name ?? selected.person_full_name ?? ""
    );
    setPersonResults([]);
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
          <div className="text-xs text-[var(--to-ink-muted)]">
            Table: user_profile • {summary}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[280px]">
            <TextInput
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search auth id, email, person, org…"
            />
          </div>

          <Button
            variant="secondary"
            className="h-9 px-3 text-sm"
            onClick={() => refresh()}
            disabled={loading || saving}
          >
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
        <UserProfileRowsTable
          rows={rows}
          loading={loading}
          selectedAuthUserId={selected?.auth_user_id ?? null}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={totalRows}
          canPrev={canPrev}
          canNext={canNext}
          onSelect={setSelectedAuthUserId}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
        />

        <UserProfileEditorPanel
          selected={selected}
          saving={saving}
          statusDraft={statusDraft}
          corePersonIdDraft={corePersonIdDraft}
          selectedPcOrgDraft={selectedPcOrgDraft}
          isAdminDraft={isAdminDraft}
          personSearch={personSearch}
          personResults={personResults}
          personLoading={personLoading}
          pcOrgOptions={pcOrgOptions}
          pcOrgLoading={pcOrgLoading}
          setStatusDraft={setStatusDraft}
          setCorePersonIdDraft={setCorePersonIdDraft}
          setSelectedPcOrgDraft={setSelectedPcOrgDraft}
          setIsAdminDraft={setIsAdminDraft}
          setPersonSearch={setPersonSearch}
          setPersonResults={setPersonResults}
          runPersonSearch={() => void runPersonSearch()}
          onSave={() => void onSave()}
          resetDrafts={resetDrafts}
        />
      </div>
    </div>
  );
}