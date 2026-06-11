"use client";

import { useMemo, useState } from "react";

type TimelineEvent = {
  event_id: string;
  event_at: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_user_id: string | null;
  actor_full_name?: string | null;
  note: string | null;
  meta: Record<string, unknown>;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtShortTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function minutesBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

function formatMinutes(value: number | null) {
  if (value == null) return "—";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function firstTouchHealthLabel(firstTouchMinutes: number | null) {
  if (firstTouchMinutes == null) return "Open";
  if (firstTouchMinutes <= 2) return "Fast";
  if (firstTouchMinutes <= 5) return "Healthy";
  if (firstTouchMinutes <= 10) return "Slow";
  return "Aged";
}

function afterTouchLabel(value: number | null) {
  if (value == null) return "Open";
  if (value <= 2) return "Immediate";
  if (value <= 10) return "Healthy";
  return "Delayed";
}

function lifecycleHealthLabel(firstTouchMinutes: number | null) {
  if (firstTouchMinutes == null) return "Awaiting Review";
  if (firstTouchMinutes <= 2) return "Fast Start";
  if (firstTouchMinutes <= 5) return "Healthy Start";
  if (firstTouchMinutes <= 10) return "Slow Start";
  return "Aged Start";
}

function sortTimeline(timeline: TimelineEvent[]) {
  return [...timeline].sort((a, b) => {
    const aTime = new Date(a.event_at).getTime();
    const bTime = new Date(b.event_at).getTime();
    return aTime - bTime;
  });
}

function firstMatch(
  timeline: TimelineEvent[],
  match: (event: TimelineEvent) => boolean,
) {
  return timeline.find(match) ?? null;
}

function lastMatch(
  timeline: TimelineEvent[],
  match: (event: TimelineEvent) => boolean,
) {
  const reversed = [...timeline].reverse();
  return reversed.find(match) ?? null;
}

function isReviewerEvent(event: TimelineEvent, handoffActorUserId: string | null) {
  const reviewerOwned =
    event.event_type === "approved" ||
    event.event_type === "xm_verified" ||
    event.event_type === "locked" ||
    event.event_type === "followup_requested";

  if (reviewerOwned) return true;

  if (event.event_type === "status_changed" && event.from_status === "pending_review") {
    return true;
  }

  if (handoffActorUserId && event.actor_user_id && event.actor_user_id !== handoffActorUserId) {
    return true;
  }

  return false;
}

function milestoneTitle(event: TimelineEvent) {
  if (event.to_status === "pending_review") return "Queued for Review";
  if (event.event_type === "approved" || event.to_status === "approved") return "Approved";
  if (event.event_type === "followup_requested") return "Follow-Up Requested";
  if (event.event_type === "xm_verified") return "XM Verified";
  if (event.event_type === "locked") return "Locked";
  return event.event_type.replaceAll("_", " ");
}

type TimelineBucketKey =
  | "post_call"
  | "tnps_response"
  | "customer_contact"
  | "coaching"
  | "client_update"
  | "internal_note"
  | "workflow";

const TIMELINE_BUCKETS: Array<{ key: TimelineBucketKey; label: string }> = [
  { key: "post_call", label: "Post Call Activity" },
  { key: "tnps_response", label: "TNPS Response Log" },
  { key: "customer_contact", label: "Customer Contact Log" },
  { key: "coaching", label: "Coaching Log" },
  { key: "client_update", label: "Client / Comcast Update Log" },
  { key: "internal_note", label: "Internal Notes Log" },
  { key: "workflow", label: "Workflow Log" },
];

function getBucketKey(event: TimelineEvent): TimelineBucketKey {
  const explicit = String(event.meta?.log_type ?? event.meta?.bucket ?? "").toLowerCase();

  if (
    explicit === "post_call" ||
    explicit === "tnps_response" ||
    explicit === "customer_contact" ||
    explicit === "coaching" ||
    explicit === "client_update" ||
    explicit === "internal_note" ||
    explicit === "workflow"
  ) {
    return explicit;
  }

  const type = String(event.event_type ?? "").toLowerCase();

  if (type.includes("tnps") || type.includes("detractor") || type.includes("passive")) {
    return "tnps_response";
  }

  if (type.includes("contact") || type.includes("customer")) {
    return "customer_contact";
  }

  if (type.includes("coach") || type.includes("lesson")) {
    return "coaching";
  }

  if (type.includes("client") || type.includes("comcast")) {
    return "client_update";
  }

  if (type.includes("note")) {
    return "internal_note";
  }

  if (type.includes("post_call")) {
    return "post_call";
  }

  return "workflow";
}

function bucketTimeline(timeline: TimelineEvent[]) {
  const ordered = sortTimeline(timeline);
  const grouped = new Map<TimelineBucketKey, TimelineEvent[]>();

  for (const bucket of TIMELINE_BUCKETS) {
    grouped.set(bucket.key, []);
  }

  for (const event of ordered) {
    const key = getBucketKey(event);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return TIMELINE_BUCKETS.map((bucket) => ({
    ...bucket,
    events: grouped.get(bucket.key) ?? [],
  })).filter((bucket) => bucket.events.length > 0);
}

function eventTitle(event: TimelineEvent) {
  return milestoneTitle(event).replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FieldLogTimelineCard(props: {
  timeline: TimelineEvent[];
  loading: boolean;
  error: string | null;
}) {
  const { timeline, loading, error } = props;
  const [open, setOpen] = useState(false);

  const model = useMemo(() => {
    const ordered = sortTimeline(timeline);

    const handoffEvent =
      firstMatch(ordered, (e) => e.to_status === "pending_review") ??
      firstMatch(ordered, (e) => e.event_type === "submit") ??
      null;

    const handoffAt = handoffEvent?.event_at ?? null;
    const handoffActorUserId = handoffEvent?.actor_user_id ?? null;

    const eventsAfterHandoff = handoffAt
      ? ordered.filter((e) => new Date(e.event_at).getTime() >= new Date(handoffAt).getTime())
      : [];

    const firstReviewerTouch =
      firstMatch(eventsAfterHandoff, (e) => isReviewerEvent(e, handoffActorUserId)) ?? null;

    const resolvedEvent =
      lastMatch(
        eventsAfterHandoff,
        (e) =>
          e.event_type === "approved" ||
          e.to_status === "approved" ||
          e.event_type === "followup_requested",
      ) ?? null;

    const firstTouchMinutes = minutesBetween(handoffAt, firstReviewerTouch?.event_at ?? null);
    const afterTouchMinutes = minutesBetween(
      firstReviewerTouch?.event_at ?? null,
      resolvedEvent?.event_at ?? null,
    );
    const totalReviewCycleMinutes = minutesBetween(handoffAt, resolvedEvent?.event_at ?? null);

    const milestoneRows = [
      handoffEvent
        ? {
            title: "Queued for Review",
            at: handoffEvent.event_at,
            by: handoffEvent.actor_full_name ?? null,
            delta: null as number | null,
          }
        : null,
      firstReviewerTouch
        ? {
            title: "First Reviewer Touch",
            at: firstReviewerTouch.event_at,
            by: firstReviewerTouch.actor_full_name ?? null,
            delta: firstTouchMinutes,
          }
        : null,
      resolvedEvent
        ? {
            title: milestoneTitle(resolvedEvent),
            at: resolvedEvent.event_at,
            by: resolvedEvent.actor_full_name ?? null,
            delta: totalReviewCycleMinutes,
          }
        : null,
    ].filter(Boolean) as Array<{
      title: string;
      at: string;
      by: string | null;
      delta: number | null;
    }>;

    return {
      handoffAt,
      firstTouchAt: firstReviewerTouch?.event_at ?? null,
      resolvedAt: resolvedEvent?.event_at ?? null,
      firstTouchMinutes,
      afterTouchMinutes,
      totalReviewCycleMinutes,
      firstTouchHealth: firstTouchHealthLabel(firstTouchMinutes),
      afterTouchHealth: afterTouchLabel(afterTouchMinutes),
      lifecycleHealth: lifecycleHealthLabel(firstTouchMinutes),
      milestoneRows,
    };
  }, [timeline]);

  if (loading) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <div className="text-base font-semibold">Timeline</div>
        <div className="mt-3 text-sm text-muted-foreground">Loading timeline…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <div className="text-base font-semibold">Timeline</div>
        <div className="mt-3 text-sm text-red-700">{error}</div>
      </section>
    );
  }

  if (timeline.length === 0) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <div className="text-base font-semibold">Timeline</div>
        <div className="mt-3 text-sm text-muted-foreground">
          No timeline events recorded.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="text-base font-semibold">Timeline</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {model.lifecycleHealth} • First Touch {formatMinutes(model.firstTouchMinutes)}
          </div>
        </div>

        <div className="text-sm font-medium text-muted-foreground">
          {open ? "Hide" : "Show"}
        </div>
      </button>

      {!open ? null : (
        <div className="mt-3 space-y-4">
          {bucketTimeline(timeline).map((bucket) => (
            <div key={bucket.key} className="rounded-xl border bg-muted/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{bucket.label}</div>
                <div className="text-xs text-muted-foreground">{bucket.events.length}</div>
              </div>

              <div className="space-y-3">
                {bucket.events.map((event) => (
                  <div key={event.event_id} className="rounded-lg bg-background p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium">{eventTitle(event)}</div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {fmtShortTime(event.event_at)}
                      </div>
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      {fmtDate(event.event_at)}
                      {event.actor_full_name ? ` • ${event.actor_full_name}` : ""}
                    </div>

                    {event.note ? (
                      <div className="mt-2 whitespace-pre-wrap text-sm">{event.note}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                First Touch
              </div>
              <div className="mt-1 text-lg font-semibold">
                {formatMinutes(model.firstTouchMinutes)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{model.firstTouchHealth}</div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                After Touch
              </div>
              <div className="mt-1 text-lg font-semibold">
                {formatMinutes(model.afterTouchMinutes)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{model.afterTouchHealth}</div>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Review Lifecycle Health
                </div>
                <div className="mt-1 text-lg font-semibold">{model.lifecycleHealth}</div>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Total Cycle
                </div>
                <div className="mt-1 text-base font-semibold">
                  {formatMinutes(model.totalReviewCycleMinutes)}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">Handoff</div>
                <div className="font-medium">{fmtShortTime(model.handoffAt)}</div>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">First Touch</div>
                <div className="font-medium">{fmtShortTime(model.firstTouchAt)}</div>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">Resolved</div>
                <div className="font-medium">{fmtShortTime(model.resolvedAt)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {model.milestoneRows.map((row, index) => (
              <div key={`${row.title}-${index}`} className="rounded-xl border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">{row.title}</div>
                  {row.delta != null ? (
                    <div className="text-xs font-medium text-muted-foreground">
                      +{formatMinutes(row.delta)}
                    </div>
                  ) : null}
                </div>
                <div className="mt-1 text-muted-foreground">{fmtDate(row.at)}</div>
                {row.by ? <div className="mt-1 text-muted-foreground">By {row.by}</div> : null}
              </div>
            ))}
          </div>
          </div>
        </div>
      )}
    </section>
  );
}