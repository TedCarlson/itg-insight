// path: apps/web/src/features/route-lock/history/hooks/useTechHistorySearch.ts

"use client";

import { useEffect, useRef, useState } from "react";

import type { TechSearchItem } from "../lib/history.types";

type Options = {
  apiBasePath?: string;
};

export function useTechHistorySearch(
  techQuery: string,
  options?: Options,
) {
  const apiBasePath =
    options?.apiBasePath ?? "/api/route-lock/history";

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchItems, setSearchItems] = useState<TechSearchItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const canSearch = techQuery.trim().length >= 1;

  useEffect(() => {
    if (!canSearch) {
      setSearchItems([]);
      setSearchBusy(false);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      setSearchBusy(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams({
          q: techQuery.trim(),
          limit: "10",
        });

        const res = await fetch(
          `${apiBasePath}/tech-search?${params.toString()}`,
          {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          throw new Error(
            String(json?.error ?? "Failed to search technicians"),
          );
        }

        setSearchItems(Array.isArray(json.items) ? json.items : []);
        setSearchOpen(true);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }

        setSearchItems([]);
        setSearchError(
          String(err?.message ?? "Failed to search technicians"),
        );
        setSearchOpen(true);
      } finally {
        setSearchBusy(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [techQuery, canSearch, apiBasePath]);

  return {
    canSearch,
    searchOpen,
    setSearchOpen,
    searchBusy,
    searchError,
    setSearchError,
    searchItems,
    setSearchItems,
  };
}