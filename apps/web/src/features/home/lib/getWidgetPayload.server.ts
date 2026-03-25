import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type WorkspaceRole =
  | "APP_OWNER"
  | "ADMIN"
  | "TECH"
  | "BP_SUPERVISOR"
  | "BP_LEAD"
  | "BP_OWNER"
  | "ITG_SUPERVISOR"
  | "COMPANY_MANAGER"
  | "UNSCOPED"
  | "UNKNOWN";

export type PulseMetric = {
  value: number | null;
  display: string;
  note: string;
};

export type OfficePulseItem = {
  label: string;
  status: string;
  risk: string;
};

export type FeedItem = {
  type: "Dispatch" | "Field Log" | "Broadcast" | "Uploads";
  title: string;
  detail: string;
  when: string;
  meta?: string | null;
};

export type UploadStatusItem = {
  title: string;
  lastRun: string;
  actor: string;
  href?: string;
};

export type BroadcastReachSummary = {
  reachChip: string | null;
  activeBroadcast: string;
  audience: string;
  seen: string;
  unread: string;
};

export type WidgetPayload = {
  pulse: {
    org: {
      tnps: PulseMetric;
      ftr: PulseMetric;
      toolUsage: PulseMetric;
    };
    offices: OfficePulseItem[];
  };
  feed: {
    items: FeedItem[];
  };
  uploads: {
    items: UploadStatusItem[];
  };
  broadcast: {
    reach: BroadcastReachSummary;
  };
};

type Args = {
  role: WorkspaceRole;
  selectedPcOrgId: string | null;
};

type UploadSnapshotRow = {
  batch_id?: string | null;
  created_at?: string | null;
};

function emptyMetric(note: string): PulseMetric {
  return {
    value: null,
    display: "—",
    note,
  };
}

function formatPercentLike(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}`;
}

function formatRelativeWhen(value: string | null | undefined): string {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Now";
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

async function resolveManagerPulse(
  admin: ReturnType<typeof supabaseAdmin>,
  selectedPcOrgId: string
): Promise<WidgetPayload["pulse"]> {
  let tnps: number | null = null;
  let ftr: number | null = null;
  let toolUsage: number | null = null;

  try {
    const { data } = await admin
      .from("metrics_org_kpi_surface_v")
      .select("kpi_key,value")
      .eq("pc_org_id", selectedPcOrgId);

    const rows = (data ?? []) as Array<{
      kpi_key?: string | null;
      value?: number | null;
    }>;

    for (const row of rows) {
      const key = String(row.kpi_key ?? "").trim().toLowerCase();
      const value =
        typeof row.value === "number" && Number.isFinite(row.value)
          ? row.value
          : null;

      if (key === "tnps" || key === "tnps_score") {
        tnps = value;
      } else if (key === "ftr" || key === "ftr_rate") {
        ftr = value;
      } else if (
        key === "tool_usage" ||
        key === "tool_usage_rate" ||
        key === "toolusage"
      ) {
        toolUsage = value;
      }
    }
  } catch {
    // keep placeholders
  }

  return {
    org: {
      tnps: {
        value: tnps,
        display: formatPercentLike(tnps),
        note: "Primary org pulse KPI",
      },
      ftr: {
        value: ftr,
        display: formatPercentLike(ftr),
        note: "Primary org pulse KPI",
      },
      toolUsage: {
        value: toolUsage,
        display: formatPercentLike(toolUsage),
        note: "Primary org pulse KPI",
      },
    },
    offices: [
      { label: "Office 1", status: "Pending", risk: "—" },
      { label: "Office 2", status: "Pending", risk: "—" },
    ],
  };
}

function buildBaseFeedItemsWithoutUploads(): FeedItem[] {
  return [
    {
      type: "Dispatch",
      title: "Dispatch Console",
      detail: "Most recent dispatch activity will appear here.",
      when: "Pending",
    },
    {
      type: "Field Log",
      title: "Review Queue",
      detail: "Review queue and latest field-log events will appear here.",
      when: "Pending",
    },
    {
      type: "Broadcast",
      title: "Broadcast Activity",
      detail: "Latest manager bulletin activity will appear here.",
      when: "Pending",
      meta: "R: 43/63",
    },
  ];
}

async function resolveUploadFeedItems(
  admin: ReturnType<typeof supabaseAdmin>,
  selectedPcOrgId: string
): Promise<FeedItem[]> {
  try {
    const { data } = await admin
      .from("master_kpi_archive_snapshot")
      .select("batch_id,created_at")
      .eq("pc_org_id", selectedPcOrgId)
      .order("created_at", { ascending: false })
      .limit(4);

    const rows = (data ?? []) as UploadSnapshotRow[];
    if (!rows.length) return [];

    const deduped = new Set<string>();
    const items: FeedItem[] = [];

    for (const row of rows) {
      const batchId = String(row.batch_id ?? "").trim();
      const createdAt = row.created_at ?? null;
      const dedupeKey = batchId || String(createdAt ?? "");

      if (!dedupeKey || deduped.has(dedupeKey)) continue;
      deduped.add(dedupeKey);

      items.push({
        type: "Uploads",
        title: "Metrics Upload",
        detail: batchId
          ? `Batch ${batchId} processed`
          : "Metrics upload processed",
        when: formatRelativeWhen(createdAt),
      });
    }

    return items;
  } catch {
    return [];
  }
}

async function resolveManagerFeed(
  admin: ReturnType<typeof supabaseAdmin>,
  selectedPcOrgId: string
): Promise<FeedItem[]> {
  const uploadItems = await resolveUploadFeedItems(admin, selectedPcOrgId);
  const baseItems = buildBaseFeedItemsWithoutUploads();

  if (uploadItems.length) {
    return [...uploadItems, ...baseItems];
  }

  return [
    ...baseItems,
    {
      type: "Uploads",
      title: "Metrics Upload",
      detail: "Most recent upload status and audit signal will appear here.",
      when: "Pending",
    },
  ];
}

function buildDefaultFeedItems(): FeedItem[] {
  return [
    ...buildBaseFeedItemsWithoutUploads(),
    {
      type: "Uploads",
      title: "Metrics Upload",
      detail: "Most recent upload status and audit signal will appear here.",
      when: "Pending",
    },
  ];
}

function buildDefaultUploadItems(): UploadStatusItem[] {
  return [
    {
      title: "Metrics Upload",
      lastRun: "—",
      actor: "—",
      href: "/metrics/uploads",
    },
    {
      title: "Shift Validation",
      lastRun: "—",
      actor: "—",
      href: "/route-lock/shift-validation",
    },
    {
      title: "Check-In Upload",
      lastRun: "—",
      actor: "—",
      href: "/route-lock/check-in",
    },
  ];
}

function buildDefaultBroadcastReach(): BroadcastReachSummary {
  return {
    reachChip: "R: 43/63",
    activeBroadcast: "—",
    audience: "—",
    seen: "—",
    unread: "—",
  };
}

function buildDefaultWidgetPayload(): WidgetPayload {
  return {
    pulse: {
      org: {
        tnps: emptyMetric("Primary org pulse KPI"),
        ftr: emptyMetric("Primary org pulse KPI"),
        toolUsage: emptyMetric("Primary org pulse KPI"),
      },
      offices: [
        { label: "Office 1", status: "Pending", risk: "—" },
        { label: "Office 2", status: "Pending", risk: "—" },
      ],
    },
    feed: {
      items: buildDefaultFeedItems(),
    },
    uploads: {
      items: buildDefaultUploadItems(),
    },
    broadcast: {
      reach: buildDefaultBroadcastReach(),
    },
  };
}

export async function getWidgetPayload(args: Args): Promise<WidgetPayload> {
  const { role, selectedPcOrgId } = args;
  const base = buildDefaultWidgetPayload();

  if (!selectedPcOrgId) {
    return base;
  }

  const admin = supabaseAdmin();

  if (role === "COMPANY_MANAGER") {
    const [pulse, feedItems] = await Promise.all([
      resolveManagerPulse(admin, selectedPcOrgId),
      resolveManagerFeed(admin, selectedPcOrgId),
    ]);

    return {
      ...base,
      pulse,
      feed: {
        items: feedItems,
      },
    };
  }

  return base;
}

export async function getFeedWidgetPayload(args: Args): Promise<FeedItem[]> {
  const { role, selectedPcOrgId } = args;

  if (!selectedPcOrgId) {
    return buildDefaultFeedItems();
  }

  const admin = supabaseAdmin();

  if (role === "COMPANY_MANAGER") {
    return resolveManagerFeed(admin, selectedPcOrgId);
  }

  return buildDefaultFeedItems();
}