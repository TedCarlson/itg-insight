// RUN THIS
// Replace the entire file:
// apps/web/src/state/access.tsx

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/shared/data/supabase/client";
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
  const supabase = createClient();
  const { selectedOrgId } = useOrg();
  const [accessPass, setAccessPass] = useState<AccessPass | null>(null);

  const refresh = useCallback(async () => {
    if (!selectedOrgId) {
      setAccessPass(null);
      return;
    }

    const { data, error } = await supabase.rpc("get_access_pass", {
      p_pc_org_id: selectedOrgId,
    });

    if (!error) {
      setAccessPass(data ?? null);
    }
  }, [selectedOrgId, supabase]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(t);
  }, [refresh]);

  return (
    <AccessContext.Provider value={{ accessPass, refresh }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccessPass() {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error("useAccessPass must be used within AccessProvider");
  }
  return ctx;
}