"use client";

import { useCallback, useState } from "react";

export type RouteItem = {
  route_id: string;
  route_name: string;
};

export type MonthItem = {
  fiscal_month_id: string;
  month_key: string; // YYYY-MM
  label: string; // FY2026 February
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
};

export type QuotaRow = {
  quota_id: string;
  route_id: string;
  route_name: string;

  fiscal_month_id: string;
  fiscal_month_key: string; // YYYY-MM
  fiscal_month_label: string; // FY2026 February
  fiscal_month_start_date?: string;
  fiscal_month_end_date?: string;

  qh_sun: number;
  qh_mon: number;
  qh_tue: number;
  qh_wed: number;
  qh_thu: number;
  qh_fri: number;
  qh_sat: number;

  qt_hours: number;
  qt_units: number;
};

export type QuotaUpsertRow = {
  route_id: string;
  fiscal_month_id: string;
  qh_sun: number;
  qh_mon: number;
  qh_tue: number;
  qh_wed: number;
  qh_thu: number;
  qh_fri: number;
  qh_sat: number;
};
export type QuotaMonthlySummaryRow = {
  fiscal_month_id: string;
  fiscal_month_key: string | null;
  fiscal_month_label: string | null;
  fiscal_month_start_date: string | null;
  fiscal_month_end_date: string | null;
  route_count: number;
  row_count: number;
  total_hours: number;
  total_units: number;
  tech_days: number;
  estimated_headcount: number;
  hours_delta_mom: number | null;
};


export function useQuotaAdminData() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [months, setMonths] = useState<MonthItem[]>([]);

  const [monthRows, setMonthRows] = useState<QuotaRow[]>([]);
  const [historyRows, setHistoryRows] = useState<QuotaRow[]>([]);
  const [historyMonthlySummary, setHistoryMonthlySummary] = useState<QuotaMonthlySummaryRow[]>([]);
  const [canWriteQuota, setCanWriteQuota] = useState(false);

  /**
   * /api/route-lock/quota/lookups
   * Returns { routes, months }
   * NOTE: default-month selection logic stays in state hook (Edit #2)
   */
  const fetchLookups = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch("/api/route-lock/quota/lookups", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Lookups failed (${res.status})`);

      const nextRoutes = (json?.routes ?? []) as RouteItem[];
      const nextMonths = (json?.months ?? []) as MonthItem[];

      setRoutes(nextRoutes);
      setMonths(nextMonths);
      setCanWriteQuota(json?.access?.can_write_quota === true);

      return { routes: nextRoutes, months: nextMonths };
    } catch (e: any) {
      setRoutes([]);
      setMonths([]);
      setMonthRows([]);
      setHistoryRows([]);
      setHistoryMonthlySummary([]);
      setHistoryMonthlySummary([]);
      setCanWriteQuota(false);
      setErr(e?.message ?? String(e ?? "Lookups failed"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * /api/route-lock/quota/list
   * POST { fiscal_month_id, limit }
   */
  const fetchMonth = useCallback(async (fiscalMonthId: string) => {
    if (!fiscalMonthId) {
      setMonthRows([]);
      return { ok: true as const, items: [] as QuotaRow[] };
    }

    setErr(null);
    setNotice(null);

    try {
      const res = await fetch("/api/route-lock/quota/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fiscal_month_id: fiscalMonthId, limit: 800 }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `List failed (${res.status})`);

      const items = (json?.items ?? []) as QuotaRow[];
      setMonthRows(items);
      return { ok: true as const, items };
    } catch (e: any) {
      setMonthRows([]);
      setErr(e?.message ?? String(e ?? "List failed"));
      return { ok: false as const, items: [] as QuotaRow[] };
    }
  }, []);

  /**
   * /api/route-lock/quota/list
   * POST { limit }
   */
  const fetchHistory = useCallback(async () => {
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch("/api/route-lock/quota/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 1500 }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `History failed (${res.status})`);

      const items = (json?.items ?? []) as QuotaRow[];
      const monthlySummary = (json?.monthly_summary ?? []) as QuotaMonthlySummaryRow[];
      setHistoryRows(items);
      setHistoryMonthlySummary(monthlySummary);
      return { ok: true as const, items, monthlySummary };
    } catch (e: any) {
      setHistoryRows([]);
      setHistoryMonthlySummary([]);
      setErr(e?.message ?? String(e ?? "History failed"));
      return { ok: false as const, items: [] as QuotaRow[] };
    }
  }, []);

  /**
   * /api/route-lock/quota/upsert
   * POST { rows }
   * Then refresh: fetchMonth(selectedMonthId || writeMonthId) + fetchHistory()
   */
  const upsertRows = useCallback(
    async (args: { rows: QuotaUpsertRow[]; selectedMonthId: string; writeMonthId: string }) => {
      setErr(null);
      setNotice(null);

      if (args.rows.length === 0) {
        setErr("Add at least one row (select a route).");
        return { ok: false as const };
      }

      setSaving(true);
      try {
        const res = await fetch("/api/route-lock/quota/upsert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rows: args.rows }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? `Upsert failed (${res.status})`);

        setNotice(`Saved ${args.rows.length} row(s).`);

        const refreshMonthId = args.selectedMonthId || args.writeMonthId;
        await Promise.all([fetchMonth(refreshMonthId), fetchHistory()]);

        return { ok: true as const };
      } catch (e: any) {
        setErr(e?.message ?? String(e ?? "Save failed"));
        return { ok: false as const };
      } finally {
        setSaving(false);
      }
    },
    [fetchHistory, fetchMonth]
  );

  return {
    // state
    loading,
    saving,
    err,
    notice,

    routes,
    months,
    monthRows,
    historyRows,
    historyMonthlySummary,
    canWriteQuota,

    // setters
    setErr,
    setNotice,

    // actions
    fetchLookups,
    fetchMonth,
    fetchHistory,
    upsertRows,
  };
}