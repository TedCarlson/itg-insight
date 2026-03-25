"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import type { HomePayload } from "../lib/getHomePayload.server";
import type { WidgetPayload } from "../lib/getWidgetPayload.server";

import { BroadcastComposerCard } from "./widgets/BroadcastComposerCard";
import {
  OrgPulseCard,
  type OfficePulseItem,
  type OrgPulseMetric,
} from "./widgets/OrgPulseCard";
import {
  UploadStatusCard,
  type UploadStatusItem,
} from "./widgets/UploadStatusCard";
import { SmartUploadCard } from "./widgets/SmartUploadCard";
import {
  ActivityRail,
  type ActivityFeedItem,
} from "./widgets/ActivityRail";
import { useActivityFeedWidget } from "../hooks/useActivityFeedWidget";

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

function BroadcastDetailOverlay(props: {
  open: boolean;
  onClose: () => void;
  reach: WidgetPayload["broadcast"]["reach"];
}) {
  if (!props.open) return null;

  const { reach } = props;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <div className="text-sm font-semibold">Broadcast Reach Detail</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Audience saturation and read-state details for the active broadcast.
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <PulseTile
            title="Active Broadcast"
            value={reach.activeBroadcast}
            note="Current org bulletin in circulation"
          />
          <PulseTile
            title="Audience"
            value={reach.audience}
            note="How many recipients the bulletin targeted"
          />
          <PulseTile
            title="Seen"
            value={reach.seen}
            note="How many users have viewed or acknowledged it"
          />
          <PulseTile
            title="Unread"
            value={reach.unread}
            note="Outstanding users who have not yet seen the bulletin"
          />
        </div>
      </div>
    </div>
  );
}

export default function ManagerHomeWorkspace(props: {
  payload: HomePayload;
  widgetPayload: WidgetPayload;
}) {
  const { payload, widgetPayload } = props;

  const displayName = payload.full_name ?? "Manager";
  const orgLabel = payload.org_label ?? "No org selected";
  const [showBroadcastDetail, setShowBroadcastDetail] = useState(false);

  const orgPulseMetrics: [OrgPulseMetric, OrgPulseMetric, OrgPulseMetric] = [
    {
      title: "tNPS",
      value: widgetPayload.pulse.org.tnps.display,
      note: widgetPayload.pulse.org.tnps.note,
    },
    {
      title: "FTR",
      value: widgetPayload.pulse.org.ftr.display,
      note: widgetPayload.pulse.org.ftr.note,
    },
    {
      title: "Tool Usage",
      value: widgetPayload.pulse.org.toolUsage.display,
      note: widgetPayload.pulse.org.toolUsage.note,
    },
  ];

  const officePulseItems: OfficePulseItem[] = widgetPayload.pulse.offices;

  const uploadItems: UploadStatusItem[] = widgetPayload.uploads.items;

  const feed = useActivityFeedWidget({
    initialItems: widgetPayload.feed.items as ActivityFeedItem[],
    pollMs: 300_000,
  });

  return (
    <>
      <div className="space-y-6">
        <Card className="p-4">
          <div className="space-y-1">
            <div className="text-xl font-semibold">Welcome, {displayName}</div>
            <div className="text-sm text-muted-foreground">
              Company Manager • {orgLabel}
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="space-y-4">
              <BroadcastComposerCard
                onOpenReachDetail={() => setShowBroadcastDetail(true)}
              />

              <OrgPulseCard
                metrics={orgPulseMetrics}
                offices={officePulseItems}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <UploadStatusCard items={uploadItems} />
              <SmartUploadCard />
            </div>
          </div>

          <ActivityRail
            items={feed.items}
            filter={feed.filter}
            onFilterChange={feed.setFilter}
            isRefreshing={feed.isRefreshing}
            onRefresh={feed.refresh}
          />
        </div>
      </div>

      <BroadcastDetailOverlay
        open={showBroadcastDetail}
        onClose={() => setShowBroadcastDetail(false)}
        reach={widgetPayload.broadcast.reach}
      />
    </>
  );
}