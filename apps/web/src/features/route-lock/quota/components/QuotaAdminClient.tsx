"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuotaAdminData } from "../hooks/useQuotaAdminData";
import { useQuotaAdminState } from "../hooks/useQuotaAdminState";
import { QuotaAdminView } from "./QuotaAdminView";
import {
  blankWriteRows,
  cloneBlankWriteRow,
  computeTotalsFromRows,
  sumRowHours,
  toInt,
  type WriteRow,
} from "../lib/quotaMath";

type DisplayMode = "hours" | "units" | "techs";

export default function QuotaAdminClient() {
  const data = useQuotaAdminData();

  const {
    loading,
    saving,
    err,
    notice,
    routes,
    months,
    monthRows,
    historyRows, // still passed into state hook signature, but we no longer fetch on this page
    canWriteQuota,
    fetchLookups,
    fetchMonth,
    // fetchHistory, // removed from boot + props
    upsertRows,
  } = data;

  const state = useQuotaAdminState({
    routes,
    months,
    monthRows,
    historyRows,
  });

  const {
    selectedMonthId,
    setSelectedMonthId,
    writeMonthId,
    setWriteMonthId,
    filteredMonthRows,
  } = state;

  const [mode, setMode] = useState<DisplayMode>("hours");
  const [writeRows, setWriteRows] = useState<WriteRow[]>(() => blankWriteRows());

  // Wrap write-month setter so write grid resets ONLY on user month change
  const onSetWriteMonthId = useCallback(
    (next: string) => {
      setWriteMonthId(next);
      setWriteRows(blankWriteRows());
    },
    [setWriteMonthId]
  );

  // ---- bootstrap: lookups + initial datasets ----
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const lookups = await fetchLookups();
      if (!lookups || cancelled) return;

      const firstMonthId = lookups.months[0]?.fiscal_month_id ?? "";
      const monthId = selectedMonthId || firstMonthId;

      // seed selection months if unset
      if (!selectedMonthId && monthId) setSelectedMonthId(monthId);
      if (!writeMonthId && monthId) setWriteMonthId(monthId);

      if (monthId) await fetchMonth(monthId);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [fetchLookups, fetchMonth, selectedMonthId, writeMonthId, setSelectedMonthId, setWriteMonthId]);

  // reload month rows when selectedMonthId changes
  useEffect(() => {
    if (!selectedMonthId) return;
    void fetchMonth(selectedMonthId);
  }, [fetchMonth, selectedMonthId]);

  const selectedMonth = useMemo(() => {
    if (!selectedMonthId) return null;
    return months.find((m) => m.fiscal_month_id === selectedMonthId) ?? null;
  }, [months, selectedMonthId]);

  const rowsByRoute = useMemo(() => {
    return filteredMonthRows.map((r) => ({
      route_id: r.route_id,
      route_name: r.route_name,
      qh_sun: toInt(r.qh_sun),
      qh_mon: toInt(r.qh_mon),
      qh_tue: toInt(r.qh_tue),
      qh_wed: toInt(r.qh_wed),
      qh_thu: toInt(r.qh_thu),
      qh_fri: toInt(r.qh_fri),
      qh_sat: toInt(r.qh_sat),
    }));
  }, [filteredMonthRows]);

  const totals = useMemo(() => computeTotalsFromRows(rowsByRoute as any), [rowsByRoute]);

  const onAddWriteRow = useCallback(() => {
    setWriteRows((prev) => [...prev, cloneBlankWriteRow()]);
  }, []);

  const onClearWrite = useCallback(() => {
    setWriteRows(blankWriteRows());
  }, []);

  const onSaveRows = useCallback(async () => {
    const rows = writeRows
      .filter((r) => r.route_id)
      .map((r) => ({
        route_id: r.route_id,
        fiscal_month_id: writeMonthId,
        qh_sun: toInt(r.qh_sun),
        qh_mon: toInt(r.qh_mon),
        qh_tue: toInt(r.qh_tue),
        qh_wed: toInt(r.qh_wed),
        qh_thu: toInt(r.qh_thu),
        qh_fri: toInt(r.qh_fri),
        qh_sat: toInt(r.qh_sat),
      }))
      .filter((r) => sumRowHours(r as any) > 0);

    await upsertRows({
      rows,
      selectedMonthId,
      writeMonthId,
    });
  }, [upsertRows, writeRows, selectedMonthId, writeMonthId]);

  return (
    <QuotaAdminView
      status={{ loading, saving, err, notice }}
      lookups={{ routes, months }}
      read={{
        selectedMonthId,
        setSelectedMonthId,
        mode,
        setMode,
        rowsByRoute,
        totals,
        selectedMonth,
        onRefreshLookups: () => void fetchLookups(),
      }}
      write={{
        canWriteQuota,
        writeMonthId,
        setWriteMonthId: onSetWriteMonthId,
        writeRows,
        setWriteRows,
        onAddWriteRow,
        onClearWrite,
        onSaveRows,
      }}
    />
  );
}