// apps/web/src/shared/access/access.ts
export type AccessPass = {
  auth_user_id: string;
  person_id: string | null;
  pc_org_id: string | null;

  status: string;

  is_admin?: boolean;
  is_owner?: boolean;
  is_app_owner?: boolean;

  permissions?: string[];

  ui?: {
    allowed_modules?: string[];
  };
};

const CONSOLE_PERMISSIONS = [
  "org_console_manage",
  "admin_console_manage",
  "roster_manage",
  "route_lock_manage",
  "dispatch_manage",
  "metrics_manage",
  "leadership_manage",
  "permissions_manage",
];

export function hasCapability(pass: AccessPass, cap: string) {
  if (pass?.is_owner) return true;
  if (pass?.is_admin) return true;
  if (!pass?.permissions) return false;

  return pass.permissions.includes(cap);
}

export function requireCapability(pass: AccessPass, cap: string) {
  if (!hasCapability(pass, cap)) {
    const err: any = new Error("forbidden");
    err.status = 403;
    throw err;
  }
}

function hasAnyConsolePermission(pass: AccessPass | null | undefined) {
  if (!pass) return false;
  const perms = Array.isArray(pass.permissions) ? pass.permissions : [];
  return CONSOLE_PERMISSIONS.some((perm) => perms.includes(perm));
}

export function isTechExperienceUser(pass: AccessPass | null | undefined) {
  if (!pass) return false;
  if (pass.is_owner) return false;
  if (pass.is_admin) return false;
  if (pass.is_app_owner) return false;
  if (!pass.person_id) return false;

  return !hasAnyConsolePermission(pass);
}

export function hasModule(pass: AccessPass, module: string) {
  if (pass?.is_owner) return true;
  if (pass?.is_admin) return true;
  if (pass?.is_app_owner) return true;

  // Dispatch Console should be available to anyone above technician.
  // In current architecture, "above technician" is represented by having
  // at least one console/leadership/admin-style permission.
  if (module === "dispatch_console") {
    if (hasAnyConsolePermission(pass)) return true;
  }

  return pass?.ui?.allowed_modules?.includes(module) ?? false;
}

export function requireModule(pass: AccessPass, module: string) {
  if (!hasModule(pass, module)) {
    const err: any = new Error("forbidden");
    err.status = 403;
    throw err;
  }
}