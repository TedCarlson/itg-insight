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

  if (surfaceFamily === "TECH") {
    return {
      role: "TECH",
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

  return {
    role: "UNKNOWN",
    surfaceFamily,
    useScopedRail: false,
  };
}