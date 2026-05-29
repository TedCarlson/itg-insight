"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/shared/data/supabase/client";
import { useSession } from "@/state/session";
import type { PcOrgChoice } from "@/shared/lib/api";

type Lob = "FULFILLMENT" | "LOCATE";

type OrgState = {
  orgs: PcOrgChoice[];
  orgsLoading: boolean;
  orgsError: string | null;

  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;

  refreshOrgs: () => Promise<void>;
};

type OrgProviderProps = {
  children: React.ReactNode;
  lob: Lob;
};

const Ctx = createContext<OrgState | null>(null);

function storageKeyForLob(lob: Lob) {
  return `pc:selected_org_id:${lob}`;
}

async function getServerSelectedOrg(): Promise<string | null> {
  const res = await fetch("/api/profile/select-org", { method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  const v = String(json?.selected_pc_org_id ?? "").trim();
  return v ? v : null;
}

async function setServerSelectedOrg(id: string | null): Promise<void> {
  const res = await fetch("/api/profile/select-org", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selected_pc_org_id: id }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Failed to persist org selection");
}

export function OrgProvider({ children, lob }: OrgProviderProps) {
  const { ready, signedIn } = useSession();
  const supabase = useMemo(() => createClient(), []);

  const [orgs, setOrgs] = useState<PcOrgChoice[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);

  const lastPersistedRef = useRef<string | null>(null);
  const didInitRef = useRef(false);
  const lobRef = useRef<Lob>(lob);
  const refreshSeqRef = useRef(0);

  // Load persisted org selection for THIS LOB (client-only fallback)
  useEffect(() => {
    const key = storageKeyForLob(lob);
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    setSelectedOrgIdState(saved ? saved : null);
  }, [lob]);

  // Persist org selection to localStorage (LOB-scoped)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = storageKeyForLob(lob);
    if (selectedOrgId) window.localStorage.setItem(key, selectedOrgId);
    else window.localStorage.removeItem(key);
  }, [selectedOrgId, lob]);

  const refreshOrgs = useCallback(async () => {
    if (!ready || !signedIn) return;

    const refreshSeq = ++refreshSeqRef.current;

    setOrgsLoading(true);
    setOrgsError(null);

    try {
      // LOB-aware org list (must already be access-filtered in the RPC)
      const { data, error } = await supabase.rpc("orgs_for_user_lob", { p_lob: lob });
      if (error) throw error;

      const rows = (Array.isArray(data) ? data : []) as any[];

      const choices = rows.map((r) => ({
        pc_org_id: r.pc_org_id,
        pc_org_name: r.pc_org_name,
        mso_id: r.mso_id,
        mso_lob: r.mso_lob,
      })) as unknown as PcOrgChoice[];

      if (refreshSeq !== refreshSeqRef.current) return;

      setOrgs(choices);

      const serverSelected = await getServerSelectedOrg();

      const isValid = (id: string | null) =>
        !!id && choices.some((o: any) => String(o?.pc_org_id ?? "").trim() === String(id).trim());

      const localSelected = selectedOrgId;

      // Do NOT auto-pick first org: leave null and force explicit selection if not already set.
      const next =
        (isValid(serverSelected) ? serverSelected : null) ??
        (isValid(localSelected) ? localSelected : null) ??
        null;

      if (refreshSeq !== refreshSeqRef.current) return;

      setSelectedOrgIdState(next);

      // Heal server if invalid for this LOB
      if ((serverSelected ?? null) !== (next ?? null)) {
        try {
          await setServerSelectedOrg(next);
          if (refreshSeq !== refreshSeqRef.current) return;
          lastPersistedRef.current = next;
        } catch (e: any) {
          setOrgsError(e?.message ?? "Failed to persist org selection");
        }
      } else {
        lastPersistedRef.current = serverSelected ?? null;
      }
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load org choices";
      setOrgsError(msg);
      setOrgs([]);
      setSelectedOrgIdState(null);
      lastPersistedRef.current = null;
    } finally {
      setOrgsLoading(false);
      didInitRef.current = true;
    }
  }, [ready, signedIn, supabase, lob, selectedOrgId]);

  // Reset on LOB change (client + server)
  useEffect(() => {
    if (!ready) return;

    const prev = lobRef.current;
    if (prev === lob) return;

    lobRef.current = lob;

    setSelectedOrgIdState(null);
    lastPersistedRef.current = null;
    didInitRef.current = false;

    if (signedIn) {
      void setServerSelectedOrg(null).catch(() => {});
      void refreshOrgs();
    }
  }, [lob, ready, signedIn, refreshOrgs]);

  // Drive org lifecycle off session state
  useEffect(() => {
    if (!ready) return;

    if (!signedIn) {
      setOrgs([]);
      setSelectedOrgIdState(null);
      setOrgsError(null);
      setOrgsLoading(false);
      lastPersistedRef.current = null;
      didInitRef.current = false;
      return;
    }

    void refreshOrgs();
  }, [ready, signedIn, refreshOrgs]);

  // When selection changes (dropdown), persist to server immediately.
  useEffect(() => {
    if (!ready || !signedIn) return;
    if (!didInitRef.current) return;

    if ((selectedOrgId ?? null) === (lastPersistedRef.current ?? null)) return;

    let cancelled = false;

    (async () => {
      try {
        await setServerSelectedOrg(selectedOrgId ?? null);
        if (!cancelled) lastPersistedRef.current = selectedOrgId ?? null;
      } catch (e: any) {
        if (cancelled) return;
        setOrgsError(e?.message ?? "Failed to persist org selection");

        try {
          const serverSelected = await getServerSelectedOrg();
          const id = serverSelected ? serverSelected : null;
          setSelectedOrgIdState(id);
          lastPersistedRef.current = id;
        } catch {
          // keep local; error already set
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedOrgId, ready, signedIn]);

  const setSelectedOrgId = useCallback((id: string | null) => setSelectedOrgIdState(id), []);

  const value = useMemo<OrgState>(
    () => ({
      orgs,
      orgsLoading,
      orgsError,
      selectedOrgId,
      setSelectedOrgId,
      refreshOrgs,
    }),
    [orgs, orgsLoading, orgsError, selectedOrgId, setSelectedOrgId, refreshOrgs]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrg() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOrg must be used within an OrgProvider");
  return ctx;
}