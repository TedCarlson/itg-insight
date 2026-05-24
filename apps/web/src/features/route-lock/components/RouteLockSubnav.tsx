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

const NAV_ITEMS: NavItem[] = [
  { label: "Lock Summary", href: "/route-lock" },
  { label: "Lock Report", href: "/route-lock/calendar" },
  { label: "Baseline Schedule", href: "/route-lock/schedule" },
  { label: "Booking View", href: "/schedule" },
  { label: "Exceptions", href: "/route-lock/exceptions" },
  { label: "Shift Validations", href: "/route-lock/shift-validation" },
  { label: "Check-In Uploads", href: "/route-lock/check-in" },
  { label: "Manage Quota", href: "/route-lock/quota" },
  { label: "Manage Routes", href: "/route-lock/routes" },
  { label: "Tech Route History", href: "/route-lock/history" },
];

function isActive(pathname: string, href: string) {
  if (href === "/route-lock") {
    return pathname === "/route-lock";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function RouteLockSubnav() {
  const pathname = usePathname();

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cls(
              "inline-flex h-9 items-center rounded-xl border px-3 text-sm font-medium transition-colors",
              active
                ? "border-[rgba(59,130,246,0.95)] bg-[rgba(29,78,216,0.92)] text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.28)]"
                : "border-[var(--to-border)] bg-[var(--to-surface)] text-[var(--to-ink)] hover:border-[rgba(59,130,246,0.45)] hover:bg-[var(--to-surface-2)]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
