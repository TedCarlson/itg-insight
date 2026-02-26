"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/state/org";

export type Lob = "FULFILLMENT" | "LOCATE";

export type HomeBlock = {
  pc_org_home_block_id: string;
  pc_org_id: string;
  lob: Lob;
  area: string;
  sort: number;
  block_type: string;
  title: string | null;
  config: any;
  is_enabled: boolean;
};

type Result = {
  loading: boolean;
  error: string | null;
  blocks: HomeBlock[];
  byArea: Record<string, HomeBlock[]>;
  reload: () => void;
};

export function useHomeBlocks(lob: Lob): Result {
  const { selectedOrgId } = useOrg();
  const [tick, setTick] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setError(null);

      if (!selectedOrgId) {
        setLoading(false);
        setBlocks([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/home/blocks?pc_org_id=${encodeURIComponent(selectedOrgId)}&lob=${lob}`, {
          method: "GET",
        });

        const json = await res.json().catch(() => null);
        if (!alive) return;

        if (!res.ok || !json?.ok) {
          setError(json?.error ?? `HTTP ${res.status}`);
          setBlocks([]);
          return;
        }

        setBlocks((json.rows ?? []) as HomeBlock[]);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Unknown error");
        setBlocks([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [lob, selectedOrgId, tick]);

  const byArea = useMemo(() => {
    const out: Record<string, HomeBlock[]> = {};
    for (const b of blocks) {
      const k = String(b.area ?? "left");
      if (!out[k]) out[k] = [];
      out[k].push(b);
    }
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    }
    return out;
  }, [blocks]);

  return {
    loading,
    error,
    blocks,
    byArea,
    reload: () => setTick((x) => x + 1),
  };
}