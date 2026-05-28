"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PcOrgStateCoverageAdminRow = {
  pc_org_state_coverage_id: string;
  pc_org_id: string | null;
  pc_org_name: string | null;
  pc_id: string | null;
  pc_number: number | null;
  mso_id: string | null;
  mso_name: string | null;
  state_code: string | null;
  state_name: string | null;
  is_primary: boolean;
  coverage_status: "active" | "inactive";
  created_at: string | null;
  updated_at: string | null;
};

type ResponseShape = {
  rows: PcOrgStateCoverageAdminRow[];
  page: { pageIndex: number; pageSize: number; totalRows?: number };
};

export function usePcOrgStateCoverageAdmin(opts?: { pageSize?: number }) {
  const [q, setQ] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(opts?.pageSize ?? 25);
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(false);
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

      const res = await fetch(`/api/admin/catalogue/pc_org_state_coverage?${sp.toString()}`);
      const json = (await res.json()) as { rows?: PcOrgStateCoverageAdminRow[]; page?: any; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Request failed");

      setData({
        rows: json.rows ?? [],
        page: json.page ?? { pageIndex: params.pageIndex, pageSize: params.pageSize },
      });
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
    err,
    refresh: fetchNow,
  };
}
