export type HomeWidgetKind =
  | "metrics_snapshot"
  | "workforce_snapshot"
  | "route_lock_snapshot"
  | "dispatch_snapshot"
  | "quick_actions"
  | "activity_feed";

export type HomeWidgetSize = "sm" | "md" | "lg" | "wide";

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
    items: HomeMetricDatum[];
  };
  workforce_snapshot: {
    title: string;
    items: HomeMetricDatum[];
  };
  route_lock_snapshot: {
    title: string;
    items: HomeMetricDatum[];
  };
  dispatch_snapshot: {
    title: string;
    items: HomeMetricDatum[];
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
