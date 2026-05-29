// apps/web/src/shared/access/capabilities.ts

export const CAP = {
  ROSTER_VIEW: "roster_view",
  ROSTER_MANAGE: "roster_manage",

  ROUTE_LOCK_VIEW: "route_lock_view",
  ROUTE_LOCK_MANAGE: "route_lock_manage",
  SCHEDULE_EXCEPTION_SUBMIT: "schedule_exception_submit",

  METRICS_VIEW: "metrics_view",
  METRICS_MANAGE: "metrics_manage",
  METRICS_UPLOAD: "metrics_upload",

  DISPATCH_VIEW: "dispatch_view",
  DISPATCH_MANAGE: "dispatch_manage",

  ADMIN_VIEW: "admin_view",
  ADMIN_MANAGE: "admin_manage",

  ACCESS_MANAGE: "access_manage",
} as const;