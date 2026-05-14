import type { HomeWidgetPayload } from "../../contracts/widget.types";

export function ActivityFeedWidget(props: {
  payload: HomeWidgetPayload["activity_feed"];
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{props.payload.title}</div>
      <div className="space-y-2">
        {props.payload.items.length ? (
          props.payload.items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-[var(--to-border)] bg-[var(--to-surface)] p-3"
            >
              <div className="text-sm font-medium">{item.label}</div>
              {item.detail ? (
                <div className="mt-1 text-xs text-[var(--to-muted)]">{item.detail}</div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--to-border)] p-4 text-sm text-[var(--to-muted)]">
            No recent activity.
          </div>
        )}
      </div>
    </div>
  );
}
