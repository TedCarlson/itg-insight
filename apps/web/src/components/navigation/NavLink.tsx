// path: apps/web/src/components/navigation/NavLink.tsx

"use client";

import Link from "next/link";

import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Home,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import type {
  NavigationIconKey,
  ResolvedNavigationItem,
} from "@/shared/navigation/types";

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function NavigationIcon(props: {
  icon: NavigationIconKey;
  className?: string;
}) {
  switch (props.icon) {
    case "admin":
    case "shield":
      return <ShieldCheck className={props.className} />;

    case "calendar":
      return <CalendarDays className={props.className} />;

    case "route_lock":
      return <LockKeyhole className={props.className} />;

    case "chart":
      return <BarChart3 className={props.className} />;

    case "clipboard":
      return <ClipboardCheck className={props.className} />;

    case "field_log":
      return <ClipboardList className={props.className} />;

    case "map_pin":
      return <MapPin className={props.className} />;

    case "people":
    case "workforce":
      return <Users className={props.className} />;

    case "profile":
      return <UserRound className={props.className} />;

    case "home":
    default:
      return <Home className={props.className} />;
  }
}

type Props = {
  item: ResolvedNavigationItem;
  onClick?: () => void;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  mobileLabel?: string;
};

export default function NavLink(props: Props) {
  return (
    <Link
      href={props.item.href}
      prefetch={false}
      onClick={props.onClick}
      className={cls(
        props.className,
        props.item.active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <NavigationIcon
        icon={props.item.icon}
        className={props.iconClassName ?? "h-4 w-4"}
      />

      <span className={props.labelClassName}>
        {props.mobileLabel ?? props.item.label}
      </span>
    </Link>
  );
}