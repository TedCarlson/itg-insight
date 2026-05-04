// path: apps/web/src/lib/nav/resolveSurfaceFamily.ts

export type SurfaceFamily =
  | "TECH"
  | "BP"
  | "ITG_SUPERVISOR"
  | "COMPANY_MANAGER"
  | "SHARED_OPS"
  | "LOCATE"
  | "FULFILLMENT_LEGACY"
  | "UNKNOWN";

export function resolveSurfaceFamily(
  pathname: string,
  lob: "FULFILLMENT" | "LOCATE"
): SurfaceFamily {
  if (lob === "LOCATE") return "LOCATE";

  // TECH routes
  if (pathname === "/tech" || pathname.startsWith("/tech/")) {
    return "TECH";
  }

  // ITG Supervisor role surfaces
  if (
    pathname === "/company-supervisor" ||
    pathname.startsWith("/company-supervisor/")
  ) {
    return "ITG_SUPERVISOR";
  }

  // Company Manager role surfaces
  if (
    pathname === "/company-manager" ||
    pathname.startsWith("/company-manager/")
  ) {
    return "COMPANY_MANAGER";
  }

  // BP role surfaces
  if (
    pathname === "/bp/view" ||
    pathname.startsWith("/bp/view/") ||
    pathname === "/bp-supervisor" ||
    pathname.startsWith("/bp-supervisor/") ||
    pathname === "/bp-lead" ||
    pathname.startsWith("/bp-lead/") ||
    pathname === "/bp-owner" ||
    pathname.startsWith("/bp-owner/")
  ) {
    return "BP";
  }

  // Shared operational modules
  if (
    pathname.startsWith("/dispatch-console") ||
    pathname.startsWith("/field-log") ||
    pathname.startsWith("/route-lock")
  ) {
    return "SHARED_OPS";
  }

  // Everything else (old fulfillment world)
  return "FULFILLMENT_LEGACY";
}