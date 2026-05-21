export type HomeWidgetKind =
  | "metrics_snapshot"
  | "workforce_snapshot"
  | "route_lock_snapshot"
  | "dispatch_snapshot"
  | "quick_actions"
  | "activity_feed";

export type HomeWidgetSize = "small" | "medium" | "wide" | "rail_half" | "rail_full";

export type HomeMetricDatum = {
  label: string;
  value: string;
  note?: string | null;
  tone?: "neutral" | "good" | "warn" | "bad";
};

export type HomeAction = {
  label: string;
  href: string;
  description?: string | null;
};

export type HomeActivityItem = {
  id: string;
  label: string;
  detail?: string | null;
  at?: string | null;
  tone?: "neutral" | "good" | "warn" | "bad";
};

export type HomeWidgetPayload = {
  metrics_snapshot: {
    title: string;
    headline: string;
    subhead?: string | null;
    items: HomeMetricDatum[];
    alerts?: HomeActivityItem[];
    links?: HomeAction[];
  };
  workforce_snapshot: {
    title: string;
    headline: string;
    subhead?: string | null;
    items: HomeMetricDatum[];
    alerts?: HomeActivityItem[];
    links?: HomeAction[];
  };
  route_lock_snapshot: {
    title: string;
    headline: string;
    subhead?: string | null;
    items: HomeMetricDatum[];
    alerts?: HomeActivityItem[];
    links?: HomeAction[];
  };
  dispatch_snapshot: {
    title: string;
    headline: string;
    subhead?: string | null;
    items: HomeMetricDatum[];
    alerts?: HomeActivityItem[];
    links?: HomeAction[];
  };
  quick_actions: {
    title: string;
    actions: HomeAction[];
  };
  activity_feed: {
    title: string;
    items: HomeActivityItem[];
  };
};
