// apps/web/src/app/(app)/layout.tsx
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import CoreNav from "@/components/CoreNav";
import AppChrome from "@/components/AppChrome";
import { OrgProvider } from "@/state/org";
import { SessionProvider } from "@/state/session";
import { AccessProvider } from "@/state/access";
import { ToastProvider } from "@/components/ui/Toast";

type Lob = "FULFILLMENT" | "LOCATE";

function normalizeLob(v: unknown): Lob | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "FULFILLMENT") return "FULFILLMENT";
  if (s === "LOCATE") return "LOCATE";
  return null;
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/login");

  let lob: Lob = "FULFILLMENT";

  try {
    const { data: ctx } = await supabase.rpc("user_context");
    if (Array.isArray(ctx) && ctx.length > 0) {
      const fromRow = normalizeLob((ctx as any)[0]?.mso_lob);
      if (fromRow) lob = fromRow;
    }
  } catch {
    // Do not block app rendering if optional context lookup fails.
  }

  return (
    <ToastProvider>
      <SessionProvider>
        <OrgProvider lob={lob}>
          <AccessProvider>
            <div className="min-h-screen">
              <CoreNav lob={lob} />
              <AppChrome>{children}</AppChrome>
            </div>
          </AccessProvider>
        </OrgProvider>
      </SessionProvider>
    </ToastProvider>
  );
}