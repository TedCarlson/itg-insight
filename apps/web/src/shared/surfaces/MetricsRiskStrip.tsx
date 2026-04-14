// path: apps/web/src/shared/surfaces/MetricsRiskStrip.tsx

"use client";

import { Card } from "@/components/ui/Card";
import type {
  MetricsRiskInsights,
  MetricsRiskStripItem,
} from "@/shared/types/metrics/surfacePayload";

type Props = {
  title?: string;
  items: MetricsRiskStripItem[];
  insights?: MetricsRiskInsights | null;
};

function LegacyTile({ item }: { item: MetricsRiskStripItem }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {item.title}
      </div>
      <div className="mt-1 text-xl font-semibold leading-none">
        {item.value}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        {item.note ?? "—"}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TopRiskCard({ insights }: { insights: MetricsRiskInsights }) {
  return (
    <SectionCard title="Top Priority Risk">
      <div className="text-sm font-semibold">
        {insights.top_priority_kpi.label ?? "—"}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {insights.top_priority_kpi.miss_count} techs impacted
      </div>
    </SectionCard>
  );
}

function ParticipationCard({ insights }: { insights: MetricsRiskInsights }) {
  const p = insights.participation;

  const total =
    p.meets_3.count +
    p.meets_2.count +
    p.meets_1.count +
    p.meets_0.count;

  function Row(label: string, bucket: { count: number }) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {bucket.count}/{total}
        </span>
      </div>
    );
  }

  return (
    <SectionCard title="Participation">
      <div className="space-y-1">
        {Row("Meets 3/3", p.meets_3)}
        {Row("Meets 2/3", p.meets_2)}
        {Row("Meets 1/3", p.meets_1)}
        {Row("Meets 0/3", p.meets_0)}
      </div>
    </SectionCard>
  );
}

function PerformerList({
  items,
  emptyLabel,
}: {
  items: MetricsRiskInsights["top_performers"];
  emptyLabel: string;
}) {
  if (!items.length) {
    return (
      <div className="text-xs text-muted-foreground">{emptyLabel}</div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((p) => (
        <div
          key={p.tech_id}
          className="flex items-center justify-between text-xs"
        >
          <span className="truncate pr-2">
            {p.full_name ?? p.tech_id}
          </span>
          <span className="font-medium">
            {p.composite_score != null
              ? p.composite_score.toFixed(1)
              : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function TopPerformersCard({
  insights,
}: {
  insights: MetricsRiskInsights;
}) {
  return (
    <SectionCard title="Top Performers">
      <PerformerList
        items={insights.top_performers}
        emptyLabel="No top performers"
      />
    </SectionCard>
  );
}

function BottomPerformersCard({
  insights,
}: {
  insights: MetricsRiskInsights;
}) {
  return (
    <SectionCard title="Needs Attention">
      <PerformerList
        items={insights.bottom_performers}
        emptyLabel="No risks detected"
      />
    </SectionCard>
  );
}

export default function MetricsRiskStrip({
  title = "Risk",
  items,
  insights,
}: Props) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {insights ? (
          <>
            <TopRiskCard insights={insights} />
            <ParticipationCard insights={insights} />
            <TopPerformersCard insights={insights} />
            <BottomPerformersCard insights={insights} />
          </>
        ) : (
          items.map((item) => (
            <LegacyTile key={item.key} item={item} />
          ))
        )}
      </div>
    </Card>
  );
}