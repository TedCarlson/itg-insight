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

function QuickLinkTile(props: {
  href: string;
  label: string;
  note: string;
}) {
  return (
    <a
      href={props.href}
      className="rounded-xl border bg-background/60 px-3 py-3 transition hover:bg-muted/50"
    >
      <div className="text-sm font-medium">{props.label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{props.note}</div>
    </a>
  );
}

function UploadAuditTile(props: {
  title: string;
  lastRun: string;
  actor: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border bg-background/60 px-3 py-3 transition hover:bg-muted/50">
      <div className="text-sm font-medium">{props.title}</div>
      <div className="mt-2 text-xs text-muted-foreground">
        Last: {props.lastRun}
        <br />
        By: {props.actor}
      </div>
    </div>
  );

  if (!props.href) return content;

  return <a href={props.href}>{content}</a>;
}

export type UploadStatusItem = {
  title: string;
  lastRun: string;
  actor: string;
  href?: string;
};

export function UploadStatusCard(props: {
  items: UploadStatusItem[];
}) {
  return (
    <Card className="p-4">
      <SectionHeader
        title="Upload Status"
        subtitle="Quick upload audit and bridge actions."
      />

      <div className="mt-4 grid gap-3">
        <QuickLinkTile
          href="/roster"
          label="Open Team Roster"
          note="Temporary bridge into legacy roster workflow"
        />

        {props.items.map((item) => (
          <UploadAuditTile
            key={item.title}
            title={item.title}
            lastRun={item.lastRun}
            actor={item.actor}
            href={item.href}
          />
        ))}
      </div>
    </Card>
  );
}