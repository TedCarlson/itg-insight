"use client";

import React, { useEffect, useState, useCallback } from "react";

import { useQuotaAdminData } from "../hooks/useQuotaAdminData";
import { useQuotaAdminState } from "../hooks/useQuotaAdminState";
import { QuotaHistoryView } from "./QuotaHistoryView";

type DisplayMode = "hours" | "units" | "techs";

export default function QuotaHistoryClient() {
  const data = useQuotaAdminData();
  const {
    loading,
    saving,
    err,
    notice,
    months,
    historyRows,
    historyMonthlySummary,
    fetchLookups,
    fetchHistory,
  } = data;

  // History page only needs months + historyRows.
  // routes/monthRows are not used here but the hook signature expects them.
  const state = useQuotaAdminState({
    routes: [],
    months,
    monthRows: [],
    historyRows,
  });

  const [mode, setMode] = useState<DisplayMode>("hours");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const lookups = await fetchLookups();
      if (!lookups || cancelled) return;
      await fetchHistory();
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [fetchLookups, fetchHistory]);

  const onRefreshHistory = useCallback(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return (
    <QuotaHistoryView
      status={{ loading, saving, err, notice }}
      months={months}
      mode={mode}
      setMode={setMode}
      history={{
        historyMonthId: state.historyMonthId,
        setHistoryMonthId: state.setHistoryMonthId,
        historyQuery: state.historyFilter,
        setHistoryQuery: state.setHistoryFilter,
        filteredHistoryRows: state.filteredHistoryRows,
        monthlySummary: historyMonthlySummary,
        onRefreshHistory,
      }}
    />
  );
}