// path: apps/web/src/shared/navigation/icons.ts

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

import type { NavigationIconKey } from "./types";

export function iconForNavigationKey(key: NavigationIconKey) {
  switch (key) {
    case "admin":
    case "shield":
      return ShieldCheck;

    case "calendar":
      return CalendarDays;

    case "route_lock":
      return LockKeyhole;

    case "chart":
      return BarChart3;

    case "clipboard":
      return ClipboardCheck;

    case "field_log":
      return ClipboardList;

    case "home":
      return Home;

    case "map_pin":
      return MapPin;

    case "people":
    case "workforce":
      return Users;

    case "profile":
      return UserRound;

    default:
      return Home;
  }
}