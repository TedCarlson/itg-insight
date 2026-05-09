// path: apps/web/src/lib/nav/resolveCoreNavContext.ts

import type { AppRole } from "./buildRoleNav";
import type { SurfaceFamily } from "./resolveSurfaceFamily";
import { resolveSurfaceFamily } from "./resolveSurfaceFamily";

export type CoreNavContext = {
  role: AppRole;
  surfaceFamily: SurfaceFamily;
  useScopedRail: boolean;
};

export function resolveCoreNavContext(args: {
  pathname: string;
  lob: "FULFILLMENT" | "LOCATE";
}): CoreNavContext {
  const { pathname, lob } = args;
  const surfaceFamily = resolveSurfaceFamily(pathname, lob);

  if (lob === "LOCATE") {
    return {
      role: "UNKNOWN",
      surfaceFamily,
      useScopedRail: false,
    };
  }

  if (pathname === "/bp-owner" || pathname.startsWith("/bp-owner/")) {
    return {
      role: "BP_OWNER",
      surfaceFamily: "BP",
      useScopedRail: true,
    };
  }

  if (surfaceFamily === "TECH") {
    return {
      role: "TECH",
      surfaceFamily,
      useScopedRail: true,
    };
  }

  if (surfaceFamily === "ITG_SUPERVISOR") {
    return {
      role: "ITG_SUPERVISOR",
      surfaceFamily,
      useScopedRail: true,
    };
  }

  if (surfaceFamily === "COMPANY_MANAGER") {
    return {
      role: "COMPANY_MANAGER",
      surfaceFamily,
      useScopedRail: true,
    };
  }

  if (surfaceFamily === "BP") {
    return {
      role: "BP_SUPERVISOR",
      surfaceFamily,
      useScopedRail: true,
    };
  }

  if (surfaceFamily === "SHARED_OPS") {
    return {
      role: "UNKNOWN",
      surfaceFamily,
      useScopedRail: false,
    };
  }

  return {
    role: "UNKNOWN",
    surfaceFamily,
    useScopedRail: false,
  };
}