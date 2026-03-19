export type SurfaceFamily =
  | "TECH"
  | "BP"
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

  // BP V2 surface + shared operational modules
  if (
    pathname === "/bp/view" ||
    pathname.startsWith("/bp/view/") ||
    pathname.startsWith("/dispatch-console") ||
    pathname.startsWith("/field-log")
  ) {
    return "BP";
  }

  // Everything else (old fulfillment world)
  return "FULFILLMENT_LEGACY";
}