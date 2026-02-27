"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
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

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { selectedOrgId } = useOrg();
  const [accessPass, setAccessPass] = useState<AccessPass | null>(null);

  const refresh = useCallback(async () => {
    if (!selectedOrgId) {
      setAccessPass(null);
      return;
    }

    const res = await fetch(`/api/access-pass?pc_org_id=${encodeURIComponent(selectedOrgId)}`, {
      method: "GET",
      credentials: "include",
      headers: { "content-type": "application/json" },
    });

    const text = await res.text();

    if (!res.ok) {
      // Keep existing pass (don’t thrash UI) but log the body for debugging.
     
      console.log("access-pass error:", res.status, text);
      return;
    }

    // Parse once (stream already consumed by res.text()).
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
     
      console.log("access-pass parse error:", text);
      setAccessPass(null);
      return;
    }

    // Support both shapes:
    // 1) { data: AccessPass }
    // 2) AccessPass
    const nextPass: AccessPass | null = (payload?.data ?? payload) ?? null;

    setAccessPass(nextPass);
  }, [selectedOrgId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  return <AccessContext.Provider value={{ accessPass, refresh }}>{children}</AccessContext.Provider>;
}

export function useAccessPass() {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error("useAccessPass must be used within AccessProvider");
  }
  return ctx;
}