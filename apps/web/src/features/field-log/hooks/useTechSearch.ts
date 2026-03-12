"use client";

import { useEffect, useState } from "react";

export type TechSearchRow = {
  person_id: string;
  full_name: string | null;
  tech_id: string | null;
};

type TechSearchResponse = {
  ok: boolean;
  rows?: TechSearchRow[];
  error?: string;
};

export function useTechSearch(params: {
  enabled: boolean;
  pcOrgId: string | null;
  query: string;
}) {
  const { enabled, pcOrgId, query } = params;

  const [rows, setRows] = useState<TechSearchRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !pcOrgId) {
      setRows([]);
      setLoading(false);
      return;
    }

    const q = query.trim();
    if (q.length < 2) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const id = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/field-log/tech-search?pc_org_id=${encodeURIComponent(pcOrgId)}&q=${encodeURIComponent(q)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const json = (await res.json()) as TechSearchResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load technicians.");
        }

        if (!cancelled) {
          setRows(json.rows ?? []);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [enabled, pcOrgId, query]);

  return {
    rows,
    loading,
  };
}