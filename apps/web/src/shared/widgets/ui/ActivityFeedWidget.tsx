import type { HomeWidgetConfig } from "@/shared/home/contracts/home.types";
import type {
  HomeActivityItem,
  HomeWidgetPayload,
} from "@/shared/widgets/contracts/widget.types";

function toneClass(tone: HomeActivityItem["tone"]) {
  switch (tone) {
    case "good":
      return "border-emerald-200 bg-emerald-50";

    case "warn":
      return "border-amber-200 bg-amber-50";

    case "bad":
      return "border-rose-200 bg-rose-50";

    default:
      return "border-[var(--to-border)] bg-[var(--to-card-muted)]";
  }
}

function visibleItemCount(size: HomeWidgetConfig["size"]) {
  switch (size) {
    case "small":
      return 2;

    case "medium":
      return 3;

    case "rail_half":
      return 4;

    case "rail_full":
      return 8;

    case "wide":
    default:
      return 6;
  }
}

export function ActivityFeedWidget(props: {
  payload: HomeWidgetPayload["activity_feed"];
  widget?: HomeWidgetConfig;
}) {
  const size = props.widget?.size ?? "rail_half";

  const items =
    props.payload.items.slice(
      0,
      visibleItemCount(size),
    );

  const isRail =
    size === "rail_half" ||
    size === "rail_full";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
            Live Activity
          </div>

          <div className="mt-1 text-lg font-semibold text-[var(--to-foreground)]">
            Operational feed
          </div>
        </div>

        <div className="rounded-full border border-[var(--to-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--to-muted)]">
          Live
        </div>
      </div>

      <div
        className={
          isRail
            ? "mt-4 flex-1 space-y-3 overflow-y-auto pr-1"
            : "mt-4 space-y-3"
        }
      >
        {items.map((item) => {
          return (
            <div
              key={item.id}
              className={`rounded-xl border px-3 py-3 ${toneClass(item.tone)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-[var(--to-foreground)]">
                  {item.label}
                </div>

                <div className="mt-1 h-2 w-2 rounded-full bg-current opacity-60" />
              </div>

              {item.detail ? (
                <div className="mt-2 text-xs text-[var(--to-muted)]">
                  {item.detail}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
