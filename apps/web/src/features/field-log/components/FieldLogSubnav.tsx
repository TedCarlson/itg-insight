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
    key: "overview",
    label: "Overview",
    href: "/field-log",
    items: [
      { label: "Snapshot", href: "/field-log" },
      { label: "New Field Log", href: "/field-log/new" },
      { label: "My Work", href: "/field-log/mine" },
    ],
  },
  {
    key: "review",
    label: "Review",
    href: "/field-log/review",
    items: [
      { label: "Review Queue", href: "/field-log/review" },
      { label: "New Drop Packets", href: "/field-log/new-drop-report" },
    ],
  },
  {
    key: "cases",
    label: "Cases",
    href: "/field-log/cases",
    items: [
      { label: "Case Management", href: "/field-log/cases" },
      { label: "tNPS Records", href: "/field-log/tnps" },
    ],
  },
  {
    key: "history",
    label: "History",
    href: "/field-log/audit",
    items: [
      { label: "Audit Queue", href: "/field-log/audit" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/field-log") {
    return pathname === "/field-log";
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

export default function FieldLogSubnav() {
  const pathname = usePathname();
  const activeGroup = activeGroupForPath(pathname);

  return (
    <nav className="flex flex-wrap items-center gap-1.5 border-b pb-2" aria-label="Field Log workspace">
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

      <span className="mx-1 hidden h-5 border-l sm:block" aria-hidden="true" />
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
    </nav>
  );
}
