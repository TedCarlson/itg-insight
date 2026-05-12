// path: apps/web/src/features/route-lock/history/hooks/useTechHistoryData.ts

"use client";

import { useEffect, useState } from "react";
import type {
  CheckInWeeklyResponse,
  HistoryResponse,
  TechSearchItem,
} from "../lib/history.types";

export function useTechHistoryData(props: {
  selectedTech: TechSearchItem | null;
  fromDate: string;
  toDate: string;
}) {
  const { selectedTech, fromDate, toDate } = props;

  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);

  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState<CheckInWeeklyResponse | null>(null);

  useEffect(() => {
    if (!selectedTech) {
      setHistoryBusy(false);
      setHistoryError(null);
      setHistory(null);

      setCheckInBusy(false);
      setCheckInError(null);
      setCheckIn(null);
      return;
    }

    if (!selectedTech.assignment_id) {
      setHistoryBusy(false);
      setHistoryError("Selected technician is missing assignment_id.");
      setHistory(null);

      setCheckInBusy(false);
      setCheckInError("Selected technician is missing assignment_id.");
      setCheckIn(null);
      return;
    }

    if (!fromDate || !toDate) {
      setHistoryBusy(false);
      setHistoryError("Pick both from/to dates.");
      setHistory(null);

      setCheckInBusy(false);
      setCheckInError("Pick both from/to dates.");
      setCheckIn(null);
      return;
    }

    if (fromDate > toDate) {
      setHistoryBusy(false);
      setHistoryError("From date cannot be after to date.");
      setHistory(null);

      setCheckInBusy(false);
      setCheckInError("From date cannot be after to date.");
      setCheckIn(null);
      return;
    }

    const tech = selectedTech;

    const historyController = new AbortController();
    const checkInController = new AbortController();

    async function loadHistory() {
      setHistoryBusy(true);
      setHistoryError(null);

      try {
        const params = new URLSearchParams({
          assignment_id: tech.assignment_id,
          from: fromDate,
          to: toDate,
        });

        const res = await fetch(`/api/route-lock/history/tech?${params.toString()}`, {
          method: "GET",
          signal: historyController.signal,
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          throw new Error(String(json?.error ?? "Failed to load route history"));
        }

        setHistory(json as HistoryResponse);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setHistory(null);
        setHistoryError(String(err?.message ?? "Failed to load route history"));
      } finally {
        setHistoryBusy(false);
      }
    }

    async function loadCheckIn() {
      setCheckInBusy(true);
      setCheckInError(null);

      try {
        const params = new URLSearchParams({
          assignment_id: tech.assignment_id,
          from: fromDate,
          to: toDate,
        });

        const res = await fetch(`/api/route-lock/history/check-in-weekly?${params.toString()}`, {
          method: "GET",
          signal: checkInController.signal,
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          throw new Error(String(json?.error ?? "Failed to load check-in weekly summary"));
        }

        setCheckIn(json as CheckInWeeklyResponse);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setCheckIn(null);
        setCheckInError(String(err?.message ?? "Failed to load check-in weekly summary"));
      } finally {
        setCheckInBusy(false);
      }
    }

    loadHistory();
    loadCheckIn();

    return () => {
      historyController.abort();
      checkInController.abort();
    };
  }, [selectedTech, fromDate, toDate]);

  return {
    historyBusy,
    historyError,
    history,
    checkInBusy,
    checkInError,
    checkIn,
  };
}