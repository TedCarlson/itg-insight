// RUN THIS
// Replace the entire file:
// apps/web/src/features/dispatch-console/hooks/useDispatchConsoleData.ts

"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { DaySummary, EventType, LogRow, WorkforceRow } from "../lib/types";

type ToastLike = {
  push: (t: { title: string; message: string; variant?: "warning" | "danger" }) => void;
};

function qs(params: Record<string, string | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    sp.set(k, s);
  }
  return sp.toString();
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function useDispatchConsoleData(toast: ToastLike) {
  // workforce selection highlight (page can also drive this; keeping here to avoid refactor churn)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // workforce + summary
  const [loadingWorkforce, setLoadingWorkforce] = useState(false);
  const [workforce, setWorkforce] = useState<WorkforceRow[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);

  const [loadingNotScheduled, setLoadingNotScheduled] = useState(false);
  const [notScheduled, setNotScheduled] = useState<WorkforceRow[]>([]);

  // history log
  const [loadingLog, setLoadingLog] = useState(false);
  const [logRows, setLogRows] = useState<LogRow[]>([]);

  // rollup (chips)
  const [loadingRollup, setLoadingRollup] = useState(false);
  const [logRollupRows, setLogRollupRows] = useState<Array<{ assignment_id: string; event_type: EventType }>>([]);

  // simple inflight guards to prevent “loop of death” from re-requesting same key
  const inflight = useRef<Record<string, string>>({});

  const loadWorkforce = useCallback(
    async (pc_org_id: string, shiftDate: string) => {
      const key = `workforce:${pc_org_id}:${shiftDate}`;
      if (inflight.current["workforce"] === key) return;
      inflight.current["workforce"] = key;

      setLoadingWorkforce(true);
      try {
        const url = `/api/dispatch-console/workforce?${qs({ pc_org_id, shift_date: shiftDate })}`;
        const res = await fetch(url, { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || json?.ok !== true) {
          throw new Error(json?.error ?? "workforce_fetch_failed");
        }

        // YOUR API RETURNS: { ok:true, summary, rows: [...] }
        setWorkforce(asArray<WorkforceRow>(json?.rows ?? json?.workforce ?? json?.data ?? json?.result));
        setSummary((json?.summary ?? json?.day_summary ?? null) as DaySummary | null);
      } catch (e: any) {
        toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to load workforce", variant: "danger" });
        setWorkforce([]);
        setSummary(null);
      } finally {
        setLoadingWorkforce(false);
        inflight.current["workforce"] = "";
      }
    },
    [toast]
  );

  const loadNotScheduled = useCallback(
    async (pc_org_id: string, shiftDate: string) => {
      const key = `notScheduled:${pc_org_id}:${shiftDate}`;
      if (inflight.current["notScheduled"] === key) return;
      inflight.current["notScheduled"] = key;

      setLoadingNotScheduled(true);
      try {
        const url = `/api/dispatch-console/not-scheduled?${qs({ pc_org_id, shift_date: shiftDate })}`;
        const res = await fetch(url, { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || json?.ok !== true) {
          throw new Error(json?.error ?? "not_scheduled_fetch_failed");
        }

        setNotScheduled(asArray<WorkforceRow>(json?.rows ?? json?.workforce ?? json?.data ?? json?.result));
      } catch (e: any) {
        toast.push({
          title: "Dispatch Console",
          message: e?.message ?? "Failed to load not scheduled",
          variant: "danger",
        });
        setNotScheduled([]);
      } finally {
        setLoadingNotScheduled(false);
        inflight.current["notScheduled"] = "";
      }
    },
    [toast]
  );

  const loadLog = useCallback(
    async (pc_org_id: string, shiftDate: string, opts: { event_type?: EventType; assignment_id?: string | null }) => {
      const key = `log:${pc_org_id}:${shiftDate}:${opts.event_type ?? ""}:${opts.assignment_id ?? ""}`;
      if (inflight.current["log"] === key) return;
      inflight.current["log"] = key;

      setLoadingLog(true);
      try {
        const url = `/api/dispatch-console/log?${qs({
          pc_org_id,
          shift_date: shiftDate,
          event_type: opts.event_type,
          assignment_id: opts.assignment_id ?? undefined,
        })}`;

        const res = await fetch(url, { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || json?.ok !== true) {
          throw new Error(json?.error ?? "log_fetch_failed");
        }

        // accept multiple shapes
        const rows = asArray<LogRow>(json?.rows ?? json?.log_rows ?? json?.data ?? json?.result);
        setLogRows(rows);
      } catch (e: any) {
        toast.push({ title: "Dispatch Console", message: e?.message ?? "Failed to load history", variant: "danger" });
        setLogRows([]);
      } finally {
        setLoadingLog(false);
        inflight.current["log"] = "";
      }
    },
    [toast]
  );

  const loadLogRollup = useCallback(
    async (pc_org_id: string, shiftDate: string) => {
      const key = `rollup:${pc_org_id}:${shiftDate}`;
      if (inflight.current["rollup"] === key) return;
      inflight.current["rollup"] = key;

      setLoadingRollup(true);
      try {
        const url = `/api/dispatch-console/log-rollup?${qs({ pc_org_id, shift_date: shiftDate })}`;
        const res = await fetch(url, { method: "GET" });

        // your logs show 404 here — don’t spam toast, just no chips
        if (res.status === 404) {
          setLogRollupRows([]);
          return;
        }

        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok !== true) {
          throw new Error(json?.error ?? "rollup_fetch_failed");
        }

        const rows = asArray<any>(json?.rows ?? json?.data ?? json?.result);
        setLogRollupRows(
          rows
            .map((r) => ({
              assignment_id: String(r.assignment_id ?? "").trim(),
              event_type: r.event_type as EventType,
            }))
            .filter((r) => r.assignment_id)
        );
      } catch {
        // silent fail (rollup is non-critical)
        setLogRollupRows([]);
      } finally {
        setLoadingRollup(false);
        inflight.current["rollup"] = "";
      }
    },
    []
  );

  const api = useMemo(
    () => ({
      // selection
      selectedAssignmentId,
      setSelectedAssignmentId,

      // workforce
      loadingWorkforce,
      workforce,
      summary,

      // not scheduled
      loadingNotScheduled,
      notScheduled,

      // log
      loadingLog,
      logRows,

      // rollup
      loadingRollup,
      logRollupRows,

      // loaders
      loadWorkforce,
      loadNotScheduled,
      loadLog,
      loadLogRollup,
    }),
    [
      selectedAssignmentId,
      loadingWorkforce,
      workforce,
      summary,
      loadingNotScheduled,
      notScheduled,
      loadingLog,
      logRows,
      loadingRollup,
      logRollupRows,
      loadWorkforce,
      loadNotScheduled,
      loadLog,
      loadLogRollup,
    ]
  );

  return api;
}