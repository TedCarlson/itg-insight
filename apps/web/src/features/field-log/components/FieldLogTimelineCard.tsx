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
        <div className="mt-3 space-y-3">
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
      )}
    </section>
  );
}