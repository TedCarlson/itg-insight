// path: apps/web/src/features/route-lock/ota/components/OtaSummaryCards.tsx

import { Card } from "@/components/ui/Card";
import type { OtaPayload } from "../types";

export function OtaSummaryCards({ payload }: { payload: OtaPayload | null }) {
  const cards = [
    ["First Jobs", payload?.summary.first_jobs ?? "—"],
    ["Eligible", payload?.summary.eligible_count ?? "—"],
    [
      "Late",
      payload ? `${payload.summary.late_count} (${payload.summary.late_rate}%)` : "—",
    ],
    ["Avg TTFJ", payload?.summary.avg_ttfj_display ?? "—"],
    ["Worst Late", payload?.summary.worst_late_display ?? "—"],
  ];

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {cards.map(([label, value]) => (
        <Card key={label} className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold text-[var(--to-ink)]">{value}</div>
        </Card>
      ))}
    </div>
  );
}
