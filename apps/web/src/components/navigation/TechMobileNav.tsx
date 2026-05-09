// path: apps/web/src/components/navigation/TechMobileNav.tsx

"use client";

import { createPortal } from "react-dom";
import { LogOut, Menu, X } from "lucide-react";

import NavLink from "@/components/navigation/NavLink";
import type { ResolvedNavigationItem } from "@/shared/navigation/types";

function getTechTitle(pathname: string) {
  if (pathname === "/tech") return "Home";
  if (pathname.startsWith("/tech/schedule")) return "Schedule";
  if (pathname.startsWith("/tech/metrics")) return "Metrics";
  if (pathname.startsWith("/tech/field-log")) return "Field Log";
  return "Insight";
}

type Props = {
  pathname: string;
  email: string | null | undefined;
  open: boolean;
  setOpen: (next: boolean) => void;
  onSignOut: () => void;
  navItems: ResolvedNavigationItem[];
  accountItems: ResolvedNavigationItem[];
};

export default function TechMobileNav(props: Props) {
  const { pathname, email, open, setOpen, onSignOut, navItems, accountItems } =
    props;
  const title = getTechTitle(pathname);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 border-b bg-background/90 backdrop-blur">
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
          {navItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.key}
              item={item}
              className="flex flex-col items-center justify-center gap-1 px-2 py-3 text-[11px]"
              iconClassName="h-5 w-5"
            />
          ))}
        </div>
      </nav>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)}>
              <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
              <div
                className="absolute right-0 top-0 h-full w-[82vw] max-w-xs border-l bg-background shadow-2xl"
                role="dialog"
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
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
                    <div className="text-[11px] text-muted-foreground">
                      Signed in
                    </div>
                    <div className="mt-1 break-all text-sm">{email ?? "—"}</div>

                    {accountItems.map((item) => (
                      <NavLink
                        key={item.key}
                        item={item}
                        onClick={() => setOpen(false)}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                      />
                    ))}
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