"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityFeedItem } from "../components/widgets/ActivityRail";

export type ActivityFeedFilter =
  | "ALL"
  | "Dispatch"
  | "Field Log"
  | "Broadcast"
  | "Uploads";

type Args = {
  initialItems: ActivityFeedItem[];
  pollMs?: number;
};

type FeedApiResponse = {
  items: ActivityFeedItem[];
};

export function useActivityFeedWidget(args: Args) {
  const { initialItems, pollMs = 300_000 } = args;

  const [items, setItems] = useState<ActivityFeedItem[]>(() => initialItems);
  const [filter, setFilter] = useState<ActivityFeedFilter>("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const hydratedFromServerRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hydratedFromServerRef.current) return;
    setItems(initialItems);
    hydratedFromServerRef.current = true;
  }, [initialItems]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const res = await fetch("/api/home/widgets/feed", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Feed refresh failed: ${res.status}`);
      }

      const json = (await res.json()) as FeedApiResponse;

      if (mountedRef.current && Array.isArray(json.items)) {
        setItems(json.items);
      }
    } catch {
      // Keep the last known good feed.
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, pollMs);

    return () => {
      window.clearInterval(id);
    };
  }, [pollMs, refresh]);

  const filteredItems = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => item.type === filter);
  }, [items, filter]);

  return {
    items: filteredItems,
    filter,
    setFilter,
    isRefreshing,
    refresh,
  };
}