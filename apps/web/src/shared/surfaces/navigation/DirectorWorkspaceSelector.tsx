// path: apps/web/src/shared/surfaces/navigation/DirectorWorkspaceSelector.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DirectorWorkspaceKey =
  | "overview"
  | "workforce"
  | "people"
  | "metrics"
  | "route-lock";

type Item = {
  key: DirectorWorkspaceKey;
  label: string;
  href: string;
};

const ITEMS: Item[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/director/executive",
  },
  {
    key: "workforce",
    label: "Workforce",
    href: "/director/workforce",
  },
  {
    key: "people",
    label: "People",
    href: "/director/people",
  },
  {
    key: "metrics",
    label: "Metrics",
    href: "/director/metrics",
  },
  {
    key: "route-lock",
    label: "Route-Lock",
    href: "/director/route-lock",
  },
];

function normalizePath(pathname: string): DirectorWorkspaceKey {
  const value = pathname.toLowerCase();

  if (value.startsWith("/director/workforce")) {
    return "workforce";
  }

  if (value.startsWith("/director/people")) {
    return "people";
  }

  if (value.startsWith("/director/metrics")) {
    return "metrics";
  }

  if (value.startsWith("/director/route-lock")) {
    return "route-lock";
  }

  return "overview";
}

export function DirectorWorkspaceSelector() {
  const pathname = usePathname();
  const active = normalizePath(pathname);

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-[var(--to-border)] bg-[var(--to-surface)]/90 px-4 py-2 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--to-surface)]/75">
      <div className="flex min-h-10 items-center gap-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-2 pr-2">
          <div className="h-2 w-2 rounded-full bg-[var(--to-accent)] shadow-[0_0_16px_var(--to-accent)]" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--to-ink-muted)]">
            Director
          </div>
        </div>

        <div className="flex min-w-max items-center gap-1 rounded-full border border-[var(--to-border)] bg-[var(--to-surface-soft)]/80 p-1 shadow-sm">
          {ITEMS.map((item) => {
            const isActive = item.key === active;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  "whitespace-nowrap",
                  isActive
                    ? "bg-[var(--to-ink)] text-[var(--to-surface)] shadow-sm"
                    : "text-[var(--to-ink-muted)] hover:bg-[var(--to-surface)] hover:text-[var(--to-ink)]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto hidden items-center gap-2 text-[11px] text-[var(--to-ink-muted)] md:flex">
          <span className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface-soft)] px-2.5 py-1">
            Workspace
          </span>
        </div>
      </div>
    </div>
  );
}