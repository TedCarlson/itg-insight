"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type NavItem = {
  label: string;
  href: string;
};

type NavGroup = {
  key: string;
  label: string;
  href: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: "reporting",
    label: "Reporting",
    href: "/route-lock",
    items: [
      { label: "Lock Summary", href: "/route-lock" },
      { label: "Lock Report", href: "/route-lock/calendar" },
      { label: "OTA", href: "/route-lock/ota" },
      { label: "Tech Route History", href: "/route-lock/history" },
    ],
  },
  {
    key: "planning",
    label: "Planning",
    href: "/route-lock/schedule",
    items: [
      { label: "Baseline Schedule", href: "/route-lock/schedule" },
      { label: "Booking View", href: "/schedule" },
      { label: "Exceptions", href: "/route-lock/exceptions" },
    ],
  },
  {
    key: "audit",
    label: "Audit",
    href: "/route-lock/shift-validation",
    items: [
      { label: "Shift Validations", href: "/route-lock/shift-validation" },
      { label: "Check-In Uploads", href: "/route-lock/check-in" },
    ],
  },
  {
    key: "setup",
    label: "Setup",
    href: "/route-lock/quota",
    items: [
      { label: "Manage Quota", href: "/route-lock/quota" },
      { label: "Manage Routes", href: "/route-lock/routes" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/route-lock") {
    return pathname === "/route-lock";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeGroupForPath(pathname: string) {
  return (
    NAV_GROUPS.find((group) =>
      group.items.some((item) => isActive(pathname, item.href)),
    ) ?? NAV_GROUPS[0]
  );
}

export default function RouteLockSubnav() {
  const pathname = usePathname();
  const activeGroup = activeGroupForPath(pathname);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {NAV_GROUPS.map((group) => {
          const active = group.key === activeGroup.key;

          return (
            <Link
              key={group.key}
              href={group.href}
              aria-current={active ? "page" : undefined}
              className={cls(
                "inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                active
                  ? "border-[rgba(59,130,246,0.95)] bg-[rgba(29,78,216,0.92)] text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.28)]"
                  : "border-[var(--to-border)] bg-[var(--to-surface)] text-[var(--to-ink)] hover:border-[rgba(59,130,246,0.45)] hover:bg-[var(--to-surface-2)]",
              )}
            >
              {group.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {activeGroup.items.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cls(
                "inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium transition-colors",
                active
                  ? "border-[rgba(59,130,246,0.7)] bg-[rgba(59,130,246,0.14)] text-[rgb(29,78,216)]"
                  : "border-[var(--to-border)] bg-[var(--to-surface)] text-[var(--to-ink-muted)] hover:border-[rgba(59,130,246,0.35)] hover:bg-[var(--to-surface-2)] hover:text-[var(--to-ink)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
