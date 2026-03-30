"use client";

import { Card } from "@/components/ui/Card";
import type { RiskStripItem } from "@/shared/kpis/engine/buildRiskStrip";

type Props = {
  items: RiskStripItem[];
};

function RiskTile({ item }: { item: RiskStripItem }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {item.title}
      </div>

      <div className="mt-1 text-xl font-semibold leading-none">
        {item.value}
      </div>

      <div className="mt-1 text-[10px] text-muted-foreground">
        {item.note}
      </div>
    </div>
  );
}

export default function CompanySupervisorRiskStrip({ items }: Props) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Risk Strip
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <RiskTile key={item.title} item={item} />
        ))}
      </div>
    </Card>
  );
}