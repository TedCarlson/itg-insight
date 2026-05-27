"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "@/state/org";

export type ExceptionRow = {
  schedule_exception_day_id: string;
  tech_id: string;
  shift_date: string;
  exception_type: string;
  approved: boolean;
  status: "PENDING" | "APPROVED" | "DENIED" | string;
  force_off: boolean;
  override_route_id: string | null;
  override_hours: number | null;
  override_units: number | null;
  notes: string | null;
  decision_notes: string | null;
  decision_at: string | null;
  created_at: string | null;

  current_delta?: number | null;
  projected_delta?: number | null;
  impact_change?: number | null;
  impact_state?: "SAFE" | "TIGHT" | "RISK" | string | null;
};

export function useExceptions(from?: string, to?: string) {
  const { selectedOrgId } = useOrg();

  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedOrgId) {
        setRows([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("pc_org_id", selectedOrgId);

        if (from) params.set("from", from);
        if (to) params.set("to", to);

        const res = await fetch(`/api/route-lock/exceptions/list?${params.toString()}`, {
          method: "GET",
          signal,
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(String(json?.error ?? "Failed to load exceptions"));
        }

        setRows(Array.isArray(json?.rows) ? json.rows : []);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setRows([]);
        setError(String(err?.message ?? "Failed to load exceptions"));
      } finally {
        setLoading(false);
      }
    },
    [selectedOrgId, from, to]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { rows, loading, error, reload: () => load() };
}