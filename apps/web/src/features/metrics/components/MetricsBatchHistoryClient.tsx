"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export type MetricsBatchHistoryRow = {
  batch_id: string;
  fiscal_end_date: string | null;
  row_count: number | null;
  uploaded_at: string | null;
  status: string | null;
};

function formatDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

function shortBatchId(v: string) {
  return v.length > 12 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v;
}

async function copyToClipboard(v: string) {
  try {
    await navigator.clipboard.writeText(v);
  } catch {
    window.prompt("Copy batch id", v);
  }
}

function isNoiseBatch(batch: MetricsBatchHistoryRow) {
  return String(batch.status ?? "").toLowerCase() === "staged" && Number(batch.row_count ?? 0) === 0;
}

export function MetricsBatchHistoryClient({ batches }: { batches: MetricsBatchHistoryRow[] }) {
  const router = useRouter();
  const [busyBatchId, setBusyBatchId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fiscalEnd, setFiscalEnd] = useState("");
  const [showStagedNoise, setShowStagedNoise] = useState(false);

  const visibleBase = showStagedNoise ? batches : batches.filter((b) => !isNoiseBatch(b));

  const fiscalOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of visibleBase) if (b.fiscal_end_date) set.add(b.fiscal_end_date);
    return Array.from(set).sort().reverse();
  }, [visibleBase]);

  const filtered = fiscalEnd
    ? visibleBase.filter((b) => b.fiscal_end_date === fiscalEnd)
    : visibleBase;

  async function deleteBatch(batch: MetricsBatchHistoryRow) {
    const ok = window.confirm(
      [
        "Delete this exact Metrics batch?",
        "",
        `Batch ID: ${batch.batch_id}`,
        `Fiscal month end: ${batch.fiscal_end_date ?? "—"}`,
        `Rows: ${batch.row_count ?? "—"}`,
        `Uploaded: ${formatDateTime(batch.uploaded_at)}`,
      ].join("\n")
    );
    if (!ok) return;

    setBusyBatchId(batch.batch_id);
    setMessage(null);

    try {
      const res = await fetch(`/api/metrics/batches/${encodeURIComponent(batch.batch_id)}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage(`❌ ${body?.error ?? "Delete failed"}`);
        return;
      }

      setMessage(`✅ Deleted batch ${shortBatchId(batch.batch_id)}`);
      router.refresh();
    } finally {
      setBusyBatchId(null);
    }
  }

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-medium">Batch history</div>
            <div className="text-xs text-[var(--to-ink-muted)]">
              Completed uploads only by default. Staged zero-row records are hidden as system noise.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[var(--to-ink-muted)]">
              <input
                type="checkbox"
                checked={showStagedNoise}
                onChange={(e) => setShowStagedNoise(e.target.checked)}
              />
              Show staged
            </label>

            <select
              value={fiscalEnd}
              onChange={(e) => setFiscalEnd(e.target.value)}
              className="h-8 rounded-md border border-[color:var(--to-border)] bg-transparent px-2 text-xs"
            >
              <option value="">All fiscal months</option>
              {fiscalOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {message ? <div className="rounded-xl border px-3 py-2 text-sm">{message}</div> : null}

        <div className="overflow-auto rounded-md border border-[color:var(--to-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--to-surface)] text-left text-[var(--to-ink-muted)]">
              <tr className="border-b">
                <th className="py-2 pr-4 pl-3">Uploaded</th>
                <th className="py-2 pr-4">Batch ID</th>
                <th className="py-2 pr-4">Fiscal End</th>
                <th className="py-2 pr-4">Rows</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((batch) => (
                <tr key={batch.batch_id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 pl-3 whitespace-nowrap">{formatDateTime(batch.uploaded_at)}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    <button
                      type="button"
                      title={batch.batch_id}
                      className="rounded border border-[color:var(--to-border)] px-2 py-1 hover:bg-[color:var(--to-surface)]"
                      onClick={() => copyToClipboard(batch.batch_id)}
                    >
                      {shortBatchId(batch.batch_id)}
                    </button>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{batch.fiscal_end_date ?? "—"}</td>
                  <td className="py-2 pr-4">{batch.row_count ?? "—"}</td>
                  <td className="py-2 pr-4">{batch.status ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">
                    <Button
                      variant="ghost"
                      className="h-8 px-3 text-xs border border-red-300 text-red-700 hover:bg-red-50"
                      disabled={Boolean(busyBatchId)}
                      onClick={() => deleteBatch(batch)}
                    >
                      {busyBatchId === batch.batch_id ? "Deleting…" : "Delete batch"}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td className="py-6 pl-3 text-[var(--to-ink-muted)]" colSpan={6}>
                    No batches found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
