import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import CoreNav from "@/components/CoreNav";
import FooterHelp from "@/components/FooterHelp";
import { OrgProvider } from "@/state/org";
import { SessionProvider } from "@/state/session";
import { ToastProvider } from "@/components/ui/Toast";

// ✅ client boundary that provides AccessProvider (Step 1 file)
import { AdminProviders } from "./AdminProviders";

type Lob = "FULFILLMENT" | "LOCATE";

function normalizeLob(v: unknown): Lob | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "FULFILLMENT") return "FULFILLMENT";
  if (s === "LOCATE") return "LOCATE";
  return null;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
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

  // signed-in gate
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/login");

  // resolve lob, but never hard-fail
  let lob: Lob = "FULFILLMENT";
  try {
    const { data: ctx } = await supabase.rpc("user_context");
    if (Array.isArray(ctx) && ctx.length > 0) {
      const fromRow = normalizeLob((ctx as any)[0]?.mso_lob);
      if (fromRow) lob = fromRow;
    }
  } catch {
    // swallow
  }

  // route-aware layout tweak (catalogue wants wide console layout)
  const h = await headers();
  const path = h.get("next-url") ?? "";
  const isCatalogue = path.startsWith("/admin/catalogue");

  return (
    <ToastProvider>
      <SessionProvider>
        <OrgProvider lob={lob}>
          {/* ✅ ensures CoreNav (and anything else under /admin) has AccessProvider */}
          <AdminProviders>
            <div className="min-h-screen">
              <CoreNav lob={lob} />

              <div className="min-h-screen flex flex-col lg:pl-72 pt-14 lg:pt-0">
                <main className={isCatalogue ? "flex-1 px-2 py-4" : "flex-1 px-6 py-6"}>
                  {children}
                </main>
                <div className={isCatalogue ? "px-2" : "px-6"}>
                  <FooterHelp />
                </div>
              </div>
            </div>
          </AdminProviders>
        </OrgProvider>
      </SessionProvider>
    </ToastProvider>
  );
}