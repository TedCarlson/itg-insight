// apps/web/src/components/TechRouteGate.tsx
"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { useOrg } from "@/state/org";
import { useAccessPass } from "@/state/access";
import { isTechExperienceUser } from "@/shared/access/access";

function getTechRedirect(pathname: string) {
  if (pathname === "/fulfillment" || pathname === "/home") return "/tech";
  if (pathname.startsWith("/roster")) return "/tech";
  if (pathname.startsWith("/dispatch-console")) return "/tech";
  if (pathname === "/metrics" || pathname.startsWith("/metrics/")) return "/tech/metrics";
  if (pathname === "/route-lock" || pathname.startsWith("/route-lock/")) return "/tech/schedule";
  if (pathname === "/field-log") return "/tech/field-log";
  if (pathname === "/field-log/new") return "/tech/field-log/new";
  if (pathname === "/field-log/mine") return "/tech/field-log/mine";
  if (pathname === "/field-log/review" || pathname.startsWith("/admin")) return "/tech";
  return null;
}

export default function TechRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { ready, signedIn } = useSession();
  const { selectedOrgId } = useOrg();
  const { accessPass } = useAccessPass();

  const waitingOnAccess = !!selectedOrgId && !accessPass;
  const isTechUser = useMemo(() => isTechExperienceUser(accessPass), [accessPass]);
  const redirectTo = useMemo(() => getTechRedirect(pathname), [pathname]);

  useEffect(() => {
    if (!ready || !signedIn) return;
    if (!selectedOrgId) return;
    if (waitingOnAccess) return;
    if (!isTechUser) return;
    if (!redirectTo) return;

    router.replace(redirectTo);
  }, [ready, signedIn, selectedOrgId, waitingOnAccess, isTechUser, redirectTo, router]);

  if (ready && signedIn && selectedOrgId && !waitingOnAccess && isTechUser && redirectTo) {
    return null;
  }

  return <>{children}</>;
}