"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/shared/data/supabase/client";

type Result = {
  loading: boolean;
  allowed: boolean;
  reason: string | null;
};

type CacheEntry = { value: boolean; at: number; reason: string | null };
const TTL_MS = 15_000;

const UI_ONLY = process.env.NEXT_PUBLIC_DISPATCH_CONSOLE_UI_ONLY === "1";

async function rpcBoolWithFallback(supabase: any, fn: string, auth_user_id?: string): Promise<boolean> {
  const apiClient: any = (supabase as any).schema ? (supabase as any).schema("api") : supabase;

  const attempts =
    fn === "is_owner"
      ? [{}]
      : [{ p_auth_user_id: auth_user_id }, { auth_user_id }];

  for (const args of attempts) {
    const { data, error } = await apiClient.rpc(fn, args);
    if (error) return false;
    return Boolean(data);
  }

  return false;
}

export function useDispatchConsoleAccess(): Result {
  const supabase = useMemo(() => createClient(), []);
  const cacheRef = useRef<CacheEntry | null>(null);

  const [loading, setLoading] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      // UI-only override: show the surface regardless of DB gate status.
      if (UI_ONLY) {
        setLoading(false);
        setAllowed(true);
        setReason("ui_only_override");
        return;
      }

      const cached = cacheRef.current;
      if (cached && Date.now() - cached.at < TTL_MS) {
        setAllowed(cached.value);
        setReason(cached.reason);
        return;
      }

      setLoading(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
          cacheRef.current = { value: false, at: Date.now(), reason: "not_authenticated" };
          setAllowed(false);
          setReason("not_authenticated");
          return;
        }

        const uid = user.id;

        const [isOwner, isItg, isBp] = await Promise.all([
          rpcBoolWithFallback(supabase, "is_owner"),
          rpcBoolWithFallback(supabase, "is_itg_supervisor", uid),
          rpcBoolWithFallback(supabase, "is_bp_supervisor", uid),
        ]);

        const ok = Boolean(isOwner || isItg || isBp);
        const why = isOwner
          ? "owner"
          : isItg
          ? "itg_supervisor"
          : isBp
          ? "bp_supervisor"
          : "not_supervisor";

        cacheRef.current = { value: ok, at: Date.now(), reason: why };
        setAllowed(ok);
        setReason(why);
      } catch {
        cacheRef.current = { value: false, at: Date.now(), reason: "error" };
        setAllowed(false);
        setReason("error");
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [supabase]);

  return { loading, allowed, reason };
}