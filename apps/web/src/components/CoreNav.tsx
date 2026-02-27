"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Home,
  LogOut,
  MapPin,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { OrgSelector } from "@/components/OrgSelector";
import { useSession } from "@/state/session";
import { useOrg } from "@/state/org";
import { useOrgConsoleAccess } from "@/hooks/useOrgConsoleAccess";

type CoreNavProps = {
  lob: "FULFILLMENT" | "LOCATE";
};

const HIDE_ON_PREFIXES = ["/login", "/access", "/auth"];

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function rememberLob(lob: "FULFILLMENT" | "LOCATE") {
  try {
    window.localStorage.setItem("to_lob", lob);
  } catch {
    /* ignore */
  }
}

export default function CoreNav({ lob }: CoreNavProps) {
  const pathname = usePathname();
  const { ready, signedIn, email, isOwner } = useSession();
  const { selectedOrgId } = useOrg();
  const { canManageConsole } = useOrgConsoleAccess();

  const shouldHideForRoute = HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p));

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Close drawer when navigating
  useEffect(() => {
    if (!open) return;
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape to close + prevent background scroll while open
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const homeHref = lob === "LOCATE" ? "/locate" : "/fulfillment";

  const navItems = useMemo<NavItem[]>(() => {
    if (lob === "LOCATE") {
      return [
        { key: "home", label: "Home", href: "/locate", icon: Home },
        { key: "dailylog", label: "Daily Log", href: "/locate/daily-log", icon: ClipboardCheck },
        { key: "roster", label: "Roster", href: "/roster", icon: Users },
      ];
    }

    return [
      { key: "home", label: "Home", href: "/fulfillment", icon: Home },
      { key: "roster", label: "Roster", href: "/roster", icon: Users },
      { key: "routelock", label: "Route Lock", href: "/route-lock", icon: CalendarDays },
      { key: "metrics", label: "Metrics", href: "/metrics", icon: BarChart3 },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console", icon: ClipboardCheck },
    ];
  }, [lob]);

  const canSeeAdmin = isOwner || canManageConsole;

  const onSignOut = useCallback(() => {
    window.location.assign("/auth/signout");
  }, []);

  const switchLob = useCallback(
    async (next: "FULFILLMENT" | "LOCATE") => {
      if (!isOwner) return;
      if (switching) return;

      const nextHref = next === "LOCATE" ? "/locate" : "/fulfillment";
      if (pathname === nextHref || pathname.startsWith(nextHref + "/")) return;

      setSwitching(true);
      try {
        rememberLob(next);

        // best-effort clear scope before switching LOB
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

  // Render guards
  if (shouldHideForRoute) return null;
  if (!ready || !signedIn) return null;

  const RailContent = ({ variant }: { variant: "rail" | "drawer" }) => (
    <div
      className={cls(
        "h-full w-full flex flex-col",
        variant === "rail" ? "px-4 py-4" : "px-5 py-5"
      )}
    >
      {/* Top: Brand + close (drawer only) */}
      <div className="flex items-center justify-between">
        <Link href={homeHref} prefetch={false} className="inline-flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span className="text-sm font-semibold">Insight</span>
        </Link>

        {variant === "drawer" ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border px-2 py-2 hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Owner LOB switch */}
      {isOwner ? (
        <div className="mt-4 rounded-lg border bg-background/60 p-2">
          <div className="text-[11px] text-muted-foreground px-1 pb-1">LOB</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={switching}
              onClick={() => switchLob("FULFILLMENT")}
              className={cls(
                "rounded-md px-2 py-2 text-sm border",
                lob === "FULFILLMENT"
                  ? "bg-muted font-medium"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              Fulfillment
            </button>
            <button
              type="button"
              disabled={switching}
              onClick={() => switchLob("LOCATE")}
              className={cls(
                "rounded-md px-2 py-2 text-sm border",
                lob === "LOCATE" ? "bg-muted font-medium" : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              Locate
            </button>
          </div>
        </div>
      ) : null}

      {/* Org selector */}
      <div className="mt-4 rounded-lg border bg-background/60 p-3">
        <div className="text-[11px] text-muted-foreground mb-2">Scope</div>
        <OrgSelector label="PC" />
        {!selectedOrgId ? (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Select a PC to unlock scoped pages.
          </div>
        ) : null}
      </div>

      {/* Primary nav */}
      <div className="mt-5">
        <div className="text-[11px] text-muted-foreground mb-2 px-1">Navigate</div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={false}
                onClick={() => {
                  if (variant === "drawer") setOpen(false);
                }}
                className={cls(
                  "flex items-center gap-3 rounded-lg px-3 py-2 border",
                  active ? "bg-muted font-medium" : "hover:bg-muted/60 text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}

          {canSeeAdmin ? (
            <Link
              href="/admin"
              prefetch={false}
              onClick={() => {
                if (variant === "drawer") setOpen(false);
              }}
              className={cls(
                "mt-2 flex items-center gap-3 rounded-lg px-3 py-2 border",
                isActivePath(pathname, "/admin")
                  ? "bg-muted font-medium"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm">Admin</span>
            </Link>
          ) : null}
        </nav>
      </div>

      <div className="flex-1" />

      {/* Bottom: identity + signout */}
      <div className="mt-6 rounded-lg border bg-background/60 p-3">
        <div className="text-[11px] text-muted-foreground">Signed in</div>
        <div className="mt-1 text-sm truncate">{email ?? "—"}</div>

        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop left rail */}
      <aside className="hidden lg:block fixed left-0 top-0 z-50 h-screen w-72 border-r bg-background/80 backdrop-blur">
        <RailContent variant="rail" />
      </aside>

      {/* Mobile top bar with hamburger */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border px-2 py-2 hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <Link href={homeHref} prefetch={false} className="text-sm font-semibold">
            Insight
          </Link>

          <div className="w-10" />
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[70] lg:hidden">
              {/* Backdrop: dark + blur */}
              <button
                type="button"
                aria-label="Close menu backdrop"
                className="absolute inset-0"
                onClick={() => setOpen(false)}
                style={{ background: "rgba(0,0,0,0.35)" }}
              />
              <div className="absolute inset-0 backdrop-blur-sm" />

              {/* Drawer panel */}
              <div
                className="absolute left-0 top-0 h-full w-[88vw] max-w-sm border-r bg-background shadow-2xl"
                style={{
                  transform: "translateX(0)",
                  transition: "transform 180ms ease-out",
                }}
                role="dialog"
                aria-modal="true"
              >
                <RailContent variant="drawer" />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}