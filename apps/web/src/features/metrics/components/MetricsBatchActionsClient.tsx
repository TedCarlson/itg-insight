// apps/web/src/features/metrics/components/MetricsBatchActionsClient.tsx

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  batchId: string;
  status: string | null;
};

type ActionLane = "NSR" | "SMART";

function getAction(status: string | null): ActionLane | null {
  const s = String(status ?? "").trim().toLowerCase();

  if (s === "loaded") return "NSR";
  if (s === "nsr_complete") return "SMART";
  if (s === "nsr_failed") return "NSR";
  if (s === "smart_failed") return "SMART";

  return null;
}

export default function MetricsBatchActionsClient(props: Props) {
  const { batchId, status } = props;
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const action = getAction(status);

  async function run() {
    if (!action || busy) return;

    setBusy(true);

    try {
      const res = await fetch("/api/metrics/process-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batch_id: batchId,
          lane: action,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(String(json?.error ?? `Failed to run ${action}`));
      }

      alert(`${action} complete`);
      router.refresh();
    } catch (e: any) {
      alert(`${action} failed: ${String(e?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!action) {
    return (
      <span className="text-[11px] text-[var(--to-ink-muted)]">
        Complete
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="to-btn to-btn--secondary h-8 px-3 text-xs inline-flex items-center disabled:opacity-60"
    >
      {busy ? "Running..." : `Run ${action}`}
    </button>
  );
}