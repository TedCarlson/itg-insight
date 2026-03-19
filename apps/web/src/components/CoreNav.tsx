"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
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
import { buildRoleNav, type AppRole } from "@/lib/nav/buildRoleNav";
import { resolveCoreNavContext } from "@/lib/nav/resolveCoreNavContext";

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

const TECH_NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", href: "/tech", icon: Home },
  { key: "schedule", label: "Schedule", href: "/tech/schedule", icon: CalendarDays },
  { key: "metrics", label: "Metrics", href: "/tech/metrics", icon: BarChart3 },
  { key: "fieldlog", label: "Field Log", href: "/tech/field-log", icon: ClipboardList },
];

function getTechTitle(pathname: string) {
  if (pathname === "/tech") return "Home";
  if (pathname.startsWith("/tech/schedule")) return "Schedule";
  if (pathname.startsWith("/tech/metrics")) return "Metrics";
  if (pathname.startsWith("/tech/field-log")) return "Field Log";
  return "Insight";
}

function iconForNavKey(
  key: string
): React.ComponentType<{ className?: string }> {
  switch (key) {
    case "home":
      return Home;
    case "metrics":
      return BarChart3;
    case "schedule":
      return CalendarDays;
    case "dispatch":
      return ClipboardCheck;
    case "fieldlog":
      return ClipboardList;
    case "bpview":
      return BarChart3;
    case "roster":
      return Users;
    case "routelock":
      return CalendarDays;
    case "dailylog":
      return ClipboardCheck;
    default:
      return Home;
  }
}

function readShellRoleHint(): AppRole | null {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("shell-role-hint");
  const role = el?.getAttribute("data-shell-role");

  if (
    role === "TECH" ||
    role === "BP_SUPERVISOR" ||
    role === "BP_LEAD" ||
    role === "BP_OWNER" ||
    role === "UNKNOWN"
  ) {
    return role;
  }

  return null;
}

function mapRoleNavToItems(
  role: AppRole,
  useScopedRail: boolean,
  lob: "FULFILLMENT" | "LOCATE"
): NavItem[] {
  if (lob === "LOCATE") {
    return [
      { key: "home", label: "Home", href: "/locate", icon: Home },
      { key: "dailylog", label: "Daily Log", href: "/locate/daily-log", icon: ClipboardCheck },
      { key: "roster", label: "Roster", href: "/roster", icon: Users },
    ];
  }

  if (useScopedRail && role === "TECH") {
    return [
      { key: "home", label: "Home", href: "/home", icon: Home },
      { key: "schedule", label: "Schedule", href: "/tech/schedule", icon: CalendarDays },
      { key: "metrics", label: "Tech Metrics", href: "/tech/metrics", icon: BarChart3 },
      { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console", icon: ClipboardCheck },
      { key: "fieldlog", label: "Field Log", href: "/tech/field-log", icon: ClipboardList },
    ];
  }

  if (
    useScopedRail &&
    (role === "BP_SUPERVISOR" || role === "BP_LEAD" || role === "BP_OWNER")
  ) {
    return buildRoleNav(role).map((item) => ({
      ...item,
      icon: iconForNavKey(item.key),
    }));
  }

  return [
    { key: "home", label: "Home", href: "/home", icon: Home },
    { key: "roster", label: "Roster", href: "/roster", icon: Users },
    { key: "routelock", label: "Route Lock", href: "/route-lock", icon: CalendarDays },
    { key: "metrics", label: "Metrics", href: "/metrics", icon: BarChart3 },
    { key: "dispatch", label: "Dispatch Console", href: "/dispatch-console", icon: ClipboardCheck },
    { key: "fieldlog", label: "Field Log", href: "/field-log", icon: ClipboardList },
  ];
}

function TechMobileNav(props: {
  pathname: string;
  email: string | null | undefined;
  open: boolean;
  setOpen: (next: boolean) => void;
  onSignOut: () => void;
}) {
  const { pathname, email, open, setOpen, onSignOut } = props;
  const title = getTechTitle(pathname);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-10" />
          <div className="text-sm font-semibold">{title}</div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border hover:bg-muted"
            aria-label="Open account menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur">
        <div className="grid grid-cols-4">
          {TECH_NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={false}
                className={cls(
                  "flex flex-col items-center justify-center gap-1 px-2 py-3 text-[11px]",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[70] lg:hidden">
              <button
                type="button"
                aria-label="Close account menu backdrop"
                className="absolute inset-0"
                onClick={() => setOpen(false)}
                style={{ background: "rgba(0,0,0,0.35)" }}
              />
              <div className="absolute inset-0 backdrop-blur-sm" />

              <div
                className="absolute right-0 top-0 h-full w-[82vw] max-w-xs border-l bg-background shadow-2xl"
                role="dialog"
                aria-modal="true"
              >
                <div className="flex h-full flex-col px-5 py-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Account</div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-md border px-2 py-2 hover:bg-muted"
                      aria-label="Close account menu"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border bg-background/60 p-3">
                    <div className="text-[11px] text-muted-foreground">Signed in</div>
                    <div className="mt-1 text-sm break-all">{email ?? "—"}</div>
                  </div>

                  <div className="flex-1" />

                  <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export default function CoreNav({ lob }: CoreNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromReview = searchParams.get("from") === "review";

  const { ready, signedIn, email, isOwner } = useSession();
  const { selectedOrgId } = useOrg();
  const { canManageConsole } = useOrgConsoleAccess();

  const shouldHideForRoute = HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p));
  const isTechRoute = pathname === "/tech" || pathname.startsWith("/tech/");

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [hintRole, setHintRole] = useState<AppRole | null>(null);

  useEffect(() => {
    if (!open) return;
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  useEffect(() => {
    setHintRole(readShellRoleHint());
  }, [pathname]);

  const navContext = useMemo(() => {
    const base = resolveCoreNavContext({ pathname, lob });

    if (pathname === "/home" && hintRole) {
      return {
        role: hintRole,
        surfaceFamily:
          hintRole === "TECH"
            ? "TECH"
            : hintRole === "BP_SUPERVISOR" ||
              hintRole === "BP_LEAD" ||
              hintRole === "BP_OWNER"
            ? "BP"
            : base.surfaceFamily,
        useScopedRail: hintRole !== "UNKNOWN",
      };
    }

    return base;
  }, [pathname, lob, hintRole]);

  const homeHref = useMemo(() => {
    if (lob === "LOCATE") return "/locate";
    return "/home";
  }, [lob]);

  const navItems = useMemo<NavItem[]>(() => {
    return mapRoleNavToItems(navContext.role, navContext.useScopedRail, lob);
  }, [navContext.role, navContext.useScopedRail, lob]);

  const canSeeAdmin = isOwner || canManageConsole;

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

  const showFieldLogBack = pathname.startsWith("/field-log") && pathname !== "/field-log";
  const fieldLogBackHref = getFieldLogBackHref(pathname, fromReview);

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
      />
    );
  }

  const RailContent = ({ variant }: { variant: "rail" | "drawer" }) => (
    <div
      className={cls(
        "h-full w-full flex flex-col",
        variant === "rail" ? "px-4 py-4" : "px-5 py-5"
      )}
    >
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
                lob === "LOCATE"
                  ? "bg-muted font-medium"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              Locate
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border bg-background/60 p-3">
        <div className="text-[11px] text-muted-foreground mb-2">Scope</div>
        <OrgSelector label="PC" />
        {!selectedOrgId ? (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Select a PC to unlock scoped pages.
          </div>
        ) : null}
      </div>

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
      <aside className="hidden lg:block fixed left-0 top-0 z-50 h-screen w-72 border-r bg-background/80 backdrop-blur">
        <RailContent variant="rail" />
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          {showFieldLogBack ? (
            <Link
              href={fieldLogBackHref}
              prefetch={false}
              className="rounded-md border px-2 py-2 hover:bg-muted"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md border px-2 py-2 hover:bg-muted"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          <Link href={homeHref} prefetch={false} className="text-sm font-semibold">
            Insight
          </Link>

          <div className="w-10" />
        </div>
      </header>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[70] lg:hidden">
              <button
                type="button"
                aria-label="Close menu backdrop"
                className="absolute inset-0"
                onClick={() => setOpen(false)}
                style={{ background: "rgba(0,0,0,0.35)" }}
              />
              <div className="absolute inset-0 backdrop-blur-sm" />

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