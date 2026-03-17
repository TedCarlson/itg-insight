"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/state/session";
import { FieldLogLiveHeader } from "../components/FieldLogLiveHeader";
import { useFieldLogPolling } from "../hooks/useFieldLogPolling";
import { formatFreshness } from "../lib/freshness";
import {
  getStatusBorder,
  getStatusChip,
  isEditableStatus,
  niceStatus,
} from "../lib/statusStyles";

type MineRow = {
  report_id: string;
  status: string;
  category_label: string | null;
  subcategory_label: string | null;
  job_number: string;
  job_type: string | null;
  submitted_at: string | null;
  photo_count: number;
  edit_unlocked: boolean;
  followup_note: string | null;
  last_action_type?: string | null;
  approved_by_full_name?: string | null;
};

type MineResponse = {
  ok: boolean;
  data?: MineRow[];
  error?: string;
};

function getHref(row: MineRow) {
  if (row.status === "draft") return `/tech/field-log/follow-up/${row.report_id}`;
  if (row.status === "tech_followup_required" && row.edit_unlocked) {
    return `/tech/field-log/follow-up/${row.report_id}`;
  }
  return `/tech/field-log/detail/${row.report_id}`;
}

function isReturnedForReview(lastActionType?: string | null) {
  return !!lastActionType && lastActionType.toLowerCase().includes("resubmit");
}

export function TechFieldLogMineClient() {
  const { userId } = useSession();
  const [rows, setRows] = useState<MineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(
    async (showLoading = false) => {
      if (!userId) {
        setRows([]);
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);

      try {
        const res = await fetch(
          `/api/field-log/mine?createdByUserId=${encodeURIComponent(userId)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const json = (await res.json()) as MineResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load my logs.");
        }

        setRows(json.data ?? []);
        setError(null);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load my logs.");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [userId],
  );

  const manualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void load(true);
  }, [load]);

  useFieldLogPolling({
    enabled: !!userId,
    intervalMs: 30000,
    onTick: async () => {
      await load(false);
    },
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((v) => v + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  const freshnessText = useMemo(() => formatFreshness(lastUpdatedAt), [lastUpdatedAt]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        Loading my logs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FieldLogLiveHeader
        title="My Logs"
        freshnessText={freshnessText}
        refreshing={refreshing}
        onRefresh={manualRefresh}
      />

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          No field logs found.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const href = getHref(row);
            const editable = isEditableStatus(row.status, row.edit_unlocked);
            const chip = getStatusChip(row.status, row.last_action_type);
            const borderClass = getStatusBorder(row.status, row.last_action_type);
            const showApprovedBy = row.status === "approved" && !!row.approved_by_full_name;
            const showReturnedTag =
              row.status === "pending_review" && isReturnedForReview(row.last_action_type);

            return (
              <Link
                key={row.report_id}
                href={href}
                className={`block rounded-2xl border bg-card p-4 transition hover:bg-muted/40 ${borderClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{row.job_number}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {row.category_label ?? "Field Log"}
                      {row.subcategory_label ? ` • ${row.subcategory_label}` : ""}
                    </div>
                  </div>

                  <div
                    className={`inline-flex min-w-[44px] items-center justify-center rounded-full border px-2 py-1 text-xs font-semibold ${chip.className}`}
                    title={niceStatus(row.status)}
                  >
                    {chip.label}
                  </div>
                </div>

                <div className="mt-3 text-sm text-muted-foreground">
                  {row.job_type ? `Job Type: ${row.job_type.toUpperCase()} • ` : ""}
                  Photos: {row.photo_count}
                </div>

                {showReturnedTag ? (
                  <div className="mt-2 text-sm font-medium text-blue-700">
                    Returned from tech follow-up for review
                  </div>
                ) : null}

                {row.followup_note ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Follow-up: {row.followup_note}
                  </div>
                ) : null}

                {showApprovedBy ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Approved by {row.approved_by_full_name}
                  </div>
                ) : null}

                <div className="mt-3 text-xs font-medium text-muted-foreground">
                  {editable ? "Opens tech follow-up" : "Opens tech detail"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
