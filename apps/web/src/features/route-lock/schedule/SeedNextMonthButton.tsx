"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export function SeedNextMonthButton(props: {
  fromFiscalMonthId: string;
  toFiscalMonthId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSeed() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/route-lock/schedule/seed-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_fiscal_month_id: props.fromFiscalMonthId,
          to_fiscal_month_id: props.toFiscalMonthId,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        const msg = String(json?.error ?? `Seed failed (${res.status})`);
        toast.push({ variant: "danger", title: "Seed failed", message: msg, durationMs: 2600 });
        return;
      }

      toast.push({
        variant: "success",
        title: "Next month seeded",
        message: `Baseline: +${Number(json?.inserted ?? 0)} inserted • ${Number(json?.updated ?? 0)} updated`,
        durationMs: 2200,
      });

      router.refresh();
    } catch (e: any) {
      toast.push({
        variant: "danger",
        title: "Seed failed",
        message: String(e?.message ?? "Seed failed"),
        durationMs: 2600,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="to-btn to-btn--secondary h-8 px-3 text-xs"
      onClick={onSeed}
      disabled={busy || props.disabled}
      aria-disabled={busy || props.disabled}
      title="Copy current month schedule baselines into next month"
    >
      {busy ? "Seeding…" : "Seed Next from Current"}
    </button>
  );
}