import type { HomeWidgetConfig } from "@/shared/home/contracts/home.types";
import type {
  HomeActivityItem,
  HomeMetricDatum,
  HomeWidgetPayload,
} from "@/shared/widgets/contracts/widget.types";

function toneClass(tone: HomeMetricDatum["tone"] | HomeActivityItem["tone"]) {
  switch (tone) {
    case "good":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "bad":
      return "border-rose-200 bg-rose-50 text-rose-800";

    default:
      return "border-[var(--to-border)] bg-[var(--to-card-muted)] text-[var(--to-foreground)]";
  }
}

function visibleItemCount(size: HomeWidgetConfig["size"]) {
  switch (size) {
    case "small":
      return 1;

    case "medium":
      return 3;

    case "rail_half":
      return 2;

    case "rail_full":
      return 4;

    case "wide":
    default:
      return 4;
  }
}

function MetricTile(props: {
  item: HomeMetricDatum;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${toneClass(props.item.tone)}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-75">
        {props.item.label}
      </div>

      <div className="mt-1 text-xl font-semibold">
        {props.item.value}
      </div>

      {props.item.note ? (
        <div className="mt-1 text-xs opacity-75">
          {props.item.note}
        </div>
      ) : null}
    </div>
  );
}

function AlertRow(props: {
  item: HomeActivityItem;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass(props.item.tone)}`}>
      <div className="text-sm font-medium">
        {props.item.label}
      </div>

      {props.item.detail ? (
        <div className="mt-1 text-xs opacity-75">
          {props.item.detail}
        </div>
      ) : null}
    </div>
  );
}

export function WorkforceSnapshotWidget(props: {
  payload: HomeWidgetPayload["workforce_snapshot"];
  widget?: HomeWidgetConfig;
}) {
  const size = props.widget?.size ?? "wide";
  const visibleItems = props.payload.items.slice(0, visibleItemCount(size));
  const isRail = size === "rail_half" || size === "rail_full";
  const isSmall = size === "small";

  return (
    <div className="flex h-full flex-col">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
          {props.payload.title}
        </div>

        <div className="mt-1 text-lg font-semibold text-[var(--to-foreground)]">
          {props.payload.headline}
        </div>

        {!isSmall && props.payload.subhead ? (
          <div className="mt-1 text-sm text-[var(--to-muted)]">
            {props.payload.subhead}
          </div>
        ) : null}
      </div>

      <div
        className={
          isRail
            ? "mt-4 grid grid-cols-1 gap-3"
            : "mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
        }
      >
        {visibleItems.map((item) => {
          return (
            <MetricTile
              key={item.label}
              item={item}
            />
          );
        })}
      </div>

      {!isSmall && props.payload.alerts?.length ? (
        <div className="mt-4 space-y-2">
          {props.payload.alerts.slice(0, isRail ? 2 : 1).map((item) => {
            return (
              <AlertRow
                key={item.id}
                item={item}
              />
            );
          })}
        </div>
      ) : null}

      {!isSmall && props.payload.links?.length ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {props.payload.links.slice(0, isRail ? 1 : 2).map((link) => {
            return (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full border border-[var(--to-border)] px-3 py-1 text-xs font-medium text-[var(--to-foreground)] transition hover:bg-[var(--to-row-hover)]"
              >
                {link.label}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
