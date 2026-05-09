// path: apps/web/src/components/CoreNav.tsx

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  ArrowLeft,
  LogOut,
  MapPin,
  Menu,
  X,
} from "lucide-react";

import { OrgSelector } from "@/components/OrgSelector";
import NavLink from "@/components/navigation/NavLink";
import GrantChipPill from "@/components/navigation/GrantChipPill";
import { buildGrantChips } from "@/shared/navigation/grants";
import LeadershipMobileFooter from "@/components/navigation/LeadershipMobileFooter";
import TechMobileNav from "@/components/navigation/TechMobileNav";
import { useOrgConsoleAccess } from "@/hooks/useOrgConsoleAccess";
import { useAccessPass } from "@/state/access";
import { useOrg } from "@/state/org";
import { useSession } from "@/state/session";
import { resolveNavigation } from "@/shared/navigation/resolveNavigation";
import {
  persistLastScopedRole,
  readLastScopedRole,
  readShellRoleHint,
  resolveNavigationRole,
} from "@/shared/navigation/resolveNavigationRole";
import type {
  AppRole,
  ResolvedNavigationItem,
} from "@/shared/navigation/types";

type CoreNavProps = {
  lob: "FULFILLMENT" | "LOCATE";
};

const HIDE_ON_PREFIXES = ["/login", "/access", "/auth"];

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function rememberLob(lob: "FULFILLMENT" | "LOCATE") {
  try {
    window.localStorage.setItem("to_lob", lob);
  } catch {
    // ignore
  }
}

function getFieldLogBackHref(pathname: string, fromReview: boolean) {
  const isFieldLogDetail =
    pathname.startsWith("/field-log/") &&
    !pathname.startsWith("/field-log/review") &&
    !pathname.startsWith("/field-log/mine") &&
    !pathname.startsWith("/field-log/new") &&
    !pathname.startsWith("/field-log/draft");

  if (isFieldLogDetail && fromReview) {
    return "/field-log/review";
  }

  return "/field-log";
}

export default function CoreNav({ lob }: CoreNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromReview = searchParams.get("from") === "review";

  const { ready, signedIn, email, isOwner } = useSession();
  const { selectedOrgId } = useOrg();
  const { accessPass } = useAccessPass();
  const { canManageConsole } = useOrgConsoleAccess();

  const shouldHideForRoute = HIDE_ON_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [hintRole, setHintRole] = useState<AppRole | null>(null);
  const [persistedRole, setPersistedRole] = useState<AppRole | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    setHintRole(readShellRoleHint());
    setPersistedRole(readLastScopedRole());
  }, [pathname]);

  const role = useMemo(() => {
    return resolveNavigationRole({
      pathname,
      lob,
      shellRoleHint: hintRole,
      persistedRole,
      isOwner,
      isAdmin: canManageConsole,
    });
  }, [pathname, lob, hintRole, persistedRole, isOwner, canManageConsole]);

  useEffect(() => {
    persistLastScopedRole(role);
    setPersistedRole(role);
  }, [role]);

  const nav = useMemo(() => {
    return resolveNavigation({
      pathname,
      lob,
      role,
      isOwner,
      isAdmin: canManageConsole,
      permissions: accessPass?.permissions,
      selectedOrgId,
    });
  }, [
    pathname,
    lob,
    role,
    isOwner,
    canManageConsole,
    accessPass?.permissions,
    selectedOrgId,
  ]);

  const grantChips = useMemo(() => {
    return buildGrantChips(accessPass?.permissions);
  }, [accessPass?.permissions]);

  const showFieldLogBack =
    pathname.startsWith("/field-log") && pathname !== "/field-log";
  const fieldLogBackHref = getFieldLogBackHref(pathname, fromReview);

  const isTechRoute = pathname === "/tech" || pathname.startsWith("/tech/");
  const showLeadershipMobileFooter = !isTechRoute && nav.railItems.length > 0;

  const onSignOut = useCallback(() => {
    window.location.assign("/auth/signout");
  }, []);

  const switchLob = useCallback(
    async (next: "FULFILLMENT" | "LOCATE") => {
      if (!isOwner) return;
      if (switching) return;

      const nextHref = next === "LOCATE" ? "/locate" : "/home";
      if (pathname === nextHref || pathname.startsWith(nextHref + "/")) return;

      setSwitching(true);
      try {
        rememberLob(next);

        await fetch("/api/profile/select-org", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ selected_pc_org_id: null }),
        });
      } catch {
        // ignore
      } finally {
        window.location.assign(nextHref);
      }
    },
    [isOwner, pathname, switching]
  );

  if (shouldHideForRoute) return null;
  if (!ready || !signedIn) return null;

  if (isTechRoute) {
    return (
      <TechMobileNav
        pathname={pathname}
        email={email}
        open={open}
        setOpen={setOpen}
        onSignOut={onSignOut}
        navItems={nav.railItems}
        accountItems={nav.accountItems}
      />
    );
  }

  const DrawerContent = () => (
    <div className="flex h-full w-full min-h-0 flex-col px-5 py-5">
      <div className="flex items-center justify-between">
        <Link
          href={nav.workspaceHomeHref}
          prefetch={false}
          className="inline-flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <MapPin className="h-4 w-4" />
          <span className="text-sm font-semibold">Insight</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border px-2 py-2 hover:bg-muted"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {nav.showLobSwitch ? (
        <div className="mt-4 rounded-lg border bg-background/60 p-2">
          <div className="px-1 pb-1 text-[11px] text-muted-foreground">LOB</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={switching}
              onClick={() => switchLob("FULFILLMENT")}
              className={cls(
                "rounded-md border px-2 py-2 text-sm",
                lob === "FULFILLMENT"
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              Fulfillment
            </button>
            <button
              type="button"
              disabled={switching}
              onClick={() => switchLob("LOCATE")}
              className={cls(
                "rounded-md border px-2 py-2 text-sm",
                lob === "LOCATE"
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              Locate
            </button>
          </div>
        </div>
      ) : null}

      {nav.showOrgSelector ? (
        <div className="mt-4 rounded-lg border bg-background/60 p-3">
          <div className="mb-2 text-[11px] text-muted-foreground">Scope</div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <OrgSelector label="PC" />
            </div>

            {grantChips.length ? (
              <div className="flex flex-wrap justify-end gap-1 pt-0.5">
                {grantChips.map((chip) => (
                  <GrantChipPill key={chip.key} chip={chip} />
                ))}
              </div>
            ) : null}
          </div>

          {!selectedOrgId ? (
            <div className="mt-2 text-[11px] text-muted-foreground">
              Select a PC to unlock scoped pages.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mb-2 px-1 text-[11px] text-muted-foreground">
          Navigate
        </div>
        <nav className="flex flex-col gap-1">
          {nav.railItems.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              onClick={() => setOpen(false)}
              className={cls(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/60",
                item.active ? "bg-muted font-medium" : ""
              )}
            />
          ))}

          {showFieldLogBack ? (
            <Link
              href={fieldLogBackHref}
              prefetch={false}
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-3 rounded-lg border px-3 py-2 text-muted-foreground hover:bg-muted/60"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to Field Log</span>
            </Link>
          ) : null}
        </nav>
      </div>

      <div className="shrink-0 pt-4">
        <div className="rounded-lg border bg-background/60 p-3">
          <div className="text-[11px] text-muted-foreground">Signed in</div>
          <div className="mt-1 break-all text-sm">{email ?? "—"}</div>

          {nav.accountItems.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
            />
          ))}

          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showLeadershipMobileFooter ? (
        <LeadershipMobileFooter
          navItems={nav.railItems}
          onMore={() => setOpen(true)}
        />
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-50 inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background/90 shadow-sm backdrop-blur"
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)}>
              <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
              <div
                className="absolute left-0 top-0 h-full w-[82vw] max-w-sm border-r bg-background shadow-2xl"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <DrawerContent />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}