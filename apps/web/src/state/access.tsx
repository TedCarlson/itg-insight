"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "./org";

type AccessPass = {
  auth_user_id: string;
  pc_org_id: string;
  status: string;
  is_admin: boolean;
  is_app_owner: boolean;
  permissions: string[];
  ui: {
    allowed_modules: string[];
  };
  issued_at: string;
  expires_at: string;
  version: number;
};

type AccessContextType = {
  accessPass: AccessPass | null;
  refresh: () => Promise<void>;
};

const AccessContext = createContext<AccessContextType | undefined>(undefined);

async function fetchAccessPass(selectedOrgId: string): Promise<AccessPass | null> {
  const res = await fetch(`/api/access-pass?pc_org_id=${encodeURIComponent(selectedOrgId)}`, {
    method: "GET",
    credentials: "include",
    headers: { "content-type": "application/json" },
  });

  const text = await res.text();

  if (!res.ok) {
    console.log("access-pass error:", res.status, text);
    return null;
  }

  try {
    return text ? (JSON.parse(text) as AccessPass) : null;
  } catch {
    console.log("access-pass parse error:", text);
    return null;
  }
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { selectedOrgId } = useOrg();
  const [accessPassState, setAccessPassState] = useState<AccessPass | null>(null);
  const requestSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!selectedOrgId) {
      setAccessPassState(null);
      return;
    }

    const requestSeq = ++requestSeqRef.current;
    const next = await fetchAccessPass(selectedOrgId);

    if (requestSeq !== requestSeqRef.current) return;
    setAccessPassState(next);
  }, [selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId) return;

    let cancelled = false;
    const requestSeq = ++requestSeqRef.current;

    fetchAccessPass(selectedOrgId)
      .then((next) => {
        if (cancelled) return;
        if (requestSeq !== requestSeqRef.current) return;
        setAccessPassState(next);
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("access-pass fetch failure:", err);
        if (requestSeq !== requestSeqRef.current) return;
        setAccessPassState(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  const accessPass = selectedOrgId ? accessPassState : null;

  const contextValue = useMemo<AccessContextType>(
    () => ({
      accessPass,
      refresh,
    }),
    [accessPass, refresh]
  );

  return <AccessContext.Provider value={contextValue}>{children}</AccessContext.Provider>;
}

export function useAccessPass() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccessPass must be used inside <AccessProvider>");
  return ctx;
}