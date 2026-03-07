"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type UserProfileAdminRow = {
  auth_user_id: string;
  email: string | null;
  person_id: string | null;
  person_full_name: string | null;
  status: string | null;
  selected_pc_org_id: string | null;
  selected_pc_org_name: string | null;
  is_admin: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type UserProfileAdminResponse = {
  rows: UserProfileAdminRow[];
  page: { pageIndex: number; pageSize: number; totalRows?: number };
  error?: string;
};

type SavePatch = {
  auth_user_id: string;
  person_id?: string | null;
  selected_pc_org_id?: string | null;
  status?: string;
  is_admin?: boolean;
};

export function useUserProfileAdmin(opts?: { pageSize?: number }) {
  const [q, setQ] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(opts?.pageSize ?? 25);

  const [data, setData] = useState<UserProfileAdminResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const params = useMemo(() => ({ q, pageIndex, pageSize }), [q, pageIndex, pageSize]);

  const fetchNow = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const sp = new URLSearchParams();
      if (params.q.trim()) sp.set("q", params.q.trim());
      sp.set("pageIndex", String(params.pageIndex));
      sp.set("pageSize", String(params.pageSize));

      const res = await fetch(`/api/admin/catalogue/user_profile?${sp.toString()}`, { method: "GET" });
      const json = (await res.json()) as UserProfileAdminResponse & { error?: string };

      if (!res.ok) throw new Error(json?.error ?? "Request failed");
      setData(json);
    } catch (e: any) {
      setData(null);
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void fetchNow();
  }, [fetchNow]);

  const saveProfile = useCallback(
    async (patch: SavePatch) => {
      setSaving(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/catalogue/user_profile`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = (await res.json()) as { ok?: boolean; row?: UserProfileAdminRow | null; error?: string };
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Save failed");
        await fetchNow();
        return { ok: true as const, row: json?.row ?? null };
      } catch (e: any) {
        const message = e?.message ?? "Save failed";
        setErr(message);
        return { ok: false as const, error: message };
      } finally {
        setSaving(false);
      }
    },
    [fetchNow]
  );

  return {
    q,
    setQ: (v: string) => {
      setPageIndex(0);
      setQ(v);
    },

    pageIndex,
    setPageIndex,

    pageSize,
    setPageSize: (n: number) => {
      setPageIndex(0);
      setPageSize(n);
    },

    data,
    loading,
    saving,
    err,
    refresh: fetchNow,
    saveProfile,
  };
}