"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User, AuthChangeEvent, Session } from "@/shared/data/supabase/types";
import { createClient } from "@/shared/data/supabase/client";

type SessionState = {
  ready: boolean;
  signedIn: boolean;
  user: User | null;
  userId: string | null;
  email: string | null;
  isOwner: boolean;
  isAdmin: boolean;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [state, setState] = useState<SessionState>({
    ready: false,
    signedIn: false,
    user: null,
    userId: null,
    email: null,
    isOwner: false,
    isAdmin: false,
  });

  // Avoid spamming is_owner RPC on token refresh
  const lastOwnerCheckUserId = useRef<string | null>(null);

  // Keep latest isOwner without relying on stale closure state
  const isOwnerRef = useRef<boolean>(false);
  useEffect(() => {
    isOwnerRef.current = state.isOwner;
  }, [state.isOwner]);

  async function refresh(event?: AuthChangeEvent, session?: Session | null) {
    // Prefer session user if provided
    const sessionUser = session?.user ?? null;

    let user: User | null = sessionUser;
    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data.user ?? null;
    }

    const signedIn = !!user;
    const userId = user?.id ?? null;
    const email = user?.email ?? null;

    // Default values when signed out
    if (!signedIn) {
      lastOwnerCheckUserId.current = null;
      isOwnerRef.current = false;

      setState({
        ready: true,
        signedIn: false,
        user: null,
        userId: null,
        email: null,
        isOwner: false,
        isAdmin: false,
      });
      return;
    }

    // Only run owner RPC when user changes or on explicit events
    let isOwner = isOwnerRef.current;

    const shouldOwnerCheck =
      !!userId &&
      (lastOwnerCheckUserId.current !== userId ||
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        event === "SIGNED_OUT");

    if (shouldOwnerCheck) {
      try {
        const { data } = await supabase.rpc("is_owner");
        isOwner = !!data;
      } catch {
        isOwner = false;
      }
      lastOwnerCheckUserId.current = userId;
      isOwnerRef.current = isOwner;
    }

    let isAdmin = false;

    if (userId) {
      try {
        const { data } = await supabase
          .from("user_profile")
          .select("is_admin")
          .eq("auth_user_id", userId)
          .maybeSingle();

        isAdmin = data?.is_admin === true;
      } catch {
        isAdmin = false;
      }
    }

    setState({
      ready: true,
      signedIn: true,
      user,
      userId,
      email,
      isOwner,
      isAdmin,
    });
  }

  useEffect(() => {
    let alive = true;

    // Initial hydrate
    refresh().catch(() => {
      if (!alive) return;
      setState((s) => ({ ...s, ready: true }));
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        refresh(event, session).catch(() => {});
      }
    );

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
