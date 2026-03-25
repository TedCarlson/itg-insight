"use client";

import { Card } from "@/components/ui/Card";

function BlockTitle(props: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {props.children}
    </div>
  );
}

function BlockSubtitle(props: { children: React.ReactNode }) {
  return <div className="mt-1 text-sm text-muted-foreground">{props.children}</div>;
}

function SectionHeader(props: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <BlockTitle>{props.title}</BlockTitle>
        {props.subtitle ? <BlockSubtitle>{props.subtitle}</BlockSubtitle> : null}
      </div>
    </div>
  );
}

function PulseTile(props: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border bg-background/60 px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {props.title}
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none">{props.value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{props.note}</div>
    </div>
  );
}

function OfficePulseRow(props: {
  label: string;
  status: string;
  risk: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border bg-background/60 px-3 py-3">
      <div className="text-sm font-medium">{props.label}</div>
      <div className="text-sm text-muted-foreground">{props.status}</div>
      <div className="rounded-md border border-[var(--to-border)] bg-muted/10 px-2 py-1 text-xs font-medium">
        Risk: {props.risk}
      </div>
    </div>
  );
}

export type OrgPulseMetric = {
  title: string;
  value: string;
  note: string;
};

export type OfficePulseItem = {
  label: string;
  status: string;
  risk: string;
};

export function OrgPulseCard(props: {
  metrics: [OrgPulseMetric, OrgPulseMetric, OrgPulseMetric];
  offices: OfficePulseItem[];
}) {
  const { metrics, offices } = props;

  return (
    <Card className="p-4">
      <SectionHeader
        title="Org Pulse"
        subtitle="Primary KPI health and risk posture for the org."
      />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {metrics.map((metric) => (
          <PulseTile
            key={metric.title}
            title={metric.title}
            value={metric.value}
            note={metric.note}
          />
        ))}
      </div>

      <div className="mt-4 border-t pt-4">
        <SectionHeader
          title="Office Pulse"
          subtitle="Subset office health under the same org pulse language."
        />

        <div className="mt-4 space-y-3">
          {offices.map((office) => (
            <OfficePulseRow
              key={office.label}
              label={office.label}
              status={office.status}
              risk={office.risk}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}