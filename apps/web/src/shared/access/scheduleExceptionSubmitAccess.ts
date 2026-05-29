import {
  hasModule,
  isElevated,
  isTechExperienceUser,
  type AccessPass,
} from "@/shared/access/access";

export const SCHEDULE_EXCEPTION_SUBMIT_PERMISSION =
  "schedule_exception_submit";

function collectPermissions(pass: AccessPass | any) {
  return new Set(
    [
      ...(Array.isArray(pass?.permissions) ? pass.permissions : []),
      ...(Array.isArray(pass?.permission_keys) ? pass.permission_keys : []),
    ].map((value) => String(value).toLowerCase()),
  );
}

export function hasScheduleExceptionSubmitAccess(
  pass: AccessPass | null | undefined,
) {
  if (!pass) return false;
  if (isElevated(pass)) return true;
  if (!isTechExperienceUser(pass)) return true;

  const permissions = collectPermissions(pass);

  if (permissions.has(SCHEDULE_EXCEPTION_SUBMIT_PERMISSION)) return true;
  if (permissions.has("route_lock_manage")) return true;

  return hasModule(pass, "route_lock");
}

export function requireScheduleExceptionSubmitAccess(
  pass: AccessPass | null | undefined,
) {
  if (!hasScheduleExceptionSubmitAccess(pass)) {
    const err: any = new Error("forbidden");
    err.status = 403;
    throw err;
  }
}
