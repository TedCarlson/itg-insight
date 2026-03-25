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

function ReviewField(props: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background/70 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className={`mt-1 text-sm ${props.muted ? "text-muted-foreground" : ""}`}>
        {props.value}
      </div>
    </div>
  );
}

function StageReviewPane() {
  return (
    <div className="rounded-2xl border bg-background/60 p-4">
      <div className="text-sm font-medium">Stage Review</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Auto-stage and verify on file drop. Review, adjust, approve, or remove.
      </div>

      <div className="mt-4 grid gap-3">
        <ReviewField label="Detected Family" value="Awaiting file" muted />
        <ReviewField label="File Name" value="No file staged" muted />
        <ReviewField label="Status" value="Idle" muted />
        <ReviewField label="Anchor Date" value="03/25/2026" />
      </div>

      <div className="mt-4 rounded-xl border bg-muted/10 px-3 py-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Review Notes
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          Detected fiscal anchor, parser notes, warnings, and row preview will appear here.
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Approve Upload
        </button>
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Remove Staged File
        </button>
      </div>
    </div>
  );
}

export function SmartUploadCard() {
  return (
    <Card className="p-4">
      <SectionHeader
        title="Smart Upload Center"
        subtitle="Drop a file here or pick from device. The workspace will detect upload family, stage analysis automatically, and prepare the final approval path."
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-dashed bg-background/60 p-4">
          <div className="rounded-xl border bg-muted/10 px-4 py-12 text-center">
            <div className="text-sm font-medium">Drop operational file here</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Metrics, shift validation, check-in, and future upload families
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Pick File
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-background/70 px-3 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Detection Status
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Awaiting file drop. Signature detection and upload routing will appear here.
            </div>
          </div>
        </div>

        <StageReviewPane />
      </div>
    </Card>
  );
}