"use client";

import { Card } from "@/components/ui/Card";
import type { ActivityFeedFilter } from "../../hooks/useActivityFeedWidget";

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

function FeedFilterChip(props: {
  label: ActivityFeedFilter;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "rounded-full border px-2.5 py-1 text-[11px] transition",
        props.active
          ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] text-foreground"
          : "bg-background text-muted-foreground hover:bg-muted/40",
      ].join(" ")}
    >
      {props.label}
    </button>
  );
}

function FeedChip(props: {
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center justify-center rounded-md border border-[var(--to-border)] bg-muted/10 px-2 py-1 text-[11px] font-medium text-muted-foreground">
      {props.children}
    </div>
  );
}

function FeedRailItem(props: {
  type: string;
  title: string;
  detail: string;
  when: string;
  meta?: string | null;
}) {
  return (
    <div className="rounded-xl border bg-background/60 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {props.type}
          </div>
          <div className="mt-1 text-sm font-medium">{props.title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{props.detail}</div>
          {props.meta ? (
            <div className="mt-2">
              <FeedChip>{props.meta}</FeedChip>
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">{props.when}</div>
      </div>
    </div>
  );
}

export type ActivityFeedItem = {
  type: "Dispatch" | "Field Log" | "Broadcast" | "Uploads";
  title: string;
  detail: string;
  when: string;
  meta?: string | null;
};

export function ActivityRail(props: {
  items: ActivityFeedItem[];
  filter: ActivityFeedFilter;
  onFilterChange: (next: ActivityFeedFilter) => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}) {
  const {
    items,
    filter,
    onFilterChange,
    isRefreshing = false,
    onRefresh,
  } = props;

  return (
    <Card className="flex h-full min-h-[820px] flex-col p-4">
      <div className="shrink-0">
        <SectionHeader
          title="Operational Feed"
          subtitle="Activity stream across dispatch, field log, broadcasts, and uploads."
          action={
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          }
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <FeedFilterChip
            label="ALL"
            active={filter === "ALL"}
            onClick={() => onFilterChange("ALL")}
          />
          <FeedFilterChip
            label="Dispatch"
            active={filter === "Dispatch"}
            onClick={() => onFilterChange("Dispatch")}
          />
          <FeedFilterChip
            label="Field Log"
            active={filter === "Field Log"}
            onClick={() => onFilterChange("Field Log")}
          />
          <FeedFilterChip
            label="Broadcast"
            active={filter === "Broadcast"}
            onClick={() => onFilterChange("Broadcast")}
          />
          <FeedFilterChip
            label="Uploads"
            active={filter === "Uploads"}
            onClick={() => onFilterChange("Uploads")}
          />
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pr-1">
        <div className="space-y-3">
          {items.map((item, index) => (
            <FeedRailItem
              key={`${item.type}-${item.title}-${index}`}
              type={item.type}
              title={item.title}
              detail={item.detail}
              when={item.when}
              meta={item.meta}
            />
          ))}

          {items.length === 0 ? (
            <div className="rounded-xl border bg-background/60 px-3 py-4 text-sm text-muted-foreground">
              No feed items for this filter.
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}