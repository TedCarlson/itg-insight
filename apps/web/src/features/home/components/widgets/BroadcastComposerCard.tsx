"use client";

import { Info } from "lucide-react";
import { Card } from "@/components/ui/Card";

function BlockTitle(props: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {props.children}
    </div>
  );
}

function BlockSubtitle(props: { children: React.ReactNode }) {
  return (
    <div className="mt-1 text-sm text-muted-foreground">
      {props.children}
    </div>
  );
}

function SectionHeader(props: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <BlockTitle>{props.title}</BlockTitle>
        {props.subtitle ? <BlockSubtitle>{props.subtitle}</BlockSubtitle> : null}
      </div>
      {props.action ? <div className="shrink-0">{props.action}</div> : null}
    </div>
  );
}

export function BroadcastComposerCard(props: {
  onOpenReachDetail: () => void;
}) {
  return (
    <Card className="p-4">
      <SectionHeader
        title="Broadcast Center"
        subtitle="Send short bulletins, directives, and targeted notices across the org."
        action={
          <button
            type="button"
            onClick={props.onOpenReachDetail}
            className="inline-flex items-center justify-center rounded-md border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open broadcast reach details"
          >
            <Info className="h-4 w-4" />
          </button>
        }
      />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-background/60 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Type
          </div>
          <div className="mt-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
            General Bulletin
          </div>
        </div>

        <div className="rounded-xl border bg-background/60 px-3 py-3 md:col-span-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Audience
          </div>
          <div className="mt-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
            All personnel / supervisors / specific leader / specific team
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border bg-background/60 px-3 py-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Message
        </div>
        <div className="mt-2 min-h-[96px] rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Short-form composer placeholder (250 char max).
        </div>
        <div className="mt-2 text-right text-[11px] text-muted-foreground">
          0 / 250
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Create Broadcast
        </button>
      </div>
    </Card>
  );
}