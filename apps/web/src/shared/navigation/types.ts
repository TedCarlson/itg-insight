// path: apps/web/src/shared/navigation/types.ts

export type AppRole =
  | "APP_OWNER"
  | "ADMIN"
  | "DIRECTOR"
  | "TECH"
  | "ITG_SUPERVISOR"
  | "COMPANY_MANAGER"
  | "BP_SUPERVISOR"
  | "BP_LEAD"
  | "BP_OWNER"
  | "UNSCOPED"
  | "UNKNOWN";

export type NavigationIconKey =
  | "admin"
  | "calendar"
  | "chart"
  | "clipboard"
  | "field_log"
  | "home"
  | "map_pin"
  | "people"
  | "profile"
  | "route_lock"
  | "shield"
  | "workforce";

export type NavigationItemKey =
  | "home"
  | "director_executive"
  | "director_workforce"
  | "director_people"
  | "admin"
  | "bp_owner_overview"
  | "bp_owner_workforce"
  | "bp_owner_people"
  | "bp_owner_onboarding"
  | "bp_owner_metrics"
  | "company_manager_metrics"
  | "company_manager_workforce"
  | "company_manager_people"
  | "company_supervisor_metrics"
  | "company_supervisor_workforce"
  | "company_supervisor_people"
  | "bp_lead_overview"
  | "bp_lead_workforce"
  | "bp_lead_people"
  | "bp_lead_onboarding"
  | "bp_lead_metrics"
  | "bp_supervisor_overview"
  | "bp_supervisor_metrics"
  | "tech_home"
  | "tech_schedule"
  | "tech_metrics"
  | "tech_field_log"
  | "route_lock"
  | "dispatch_console"
  | "field_log"
  | "booking"
  | "metrics_uploads"
  | "roster"
  | "profile"
  | "access";

export type NavigationPermissionKey =
  | "admin_access"
  | "people_access"
  | "workforce_access"
  | "roster_manage"
  | "route_lock_access"
  | "route_lock_read"
  | "route_lock_manage"
  | "metrics_access"
  | "metrics_manage"
  | "metrics_uploads"
  | "dispatch_console_access"
  | "dispatch_manage"
  | "field_log_access"
  | "bp_owner_access";

export type NavigationItemVisibility = "default" | "grant" | "hidden";

export type NavigationItemDefinition = {
  key: NavigationItemKey;
  label: string;
  href: string;
  icon: NavigationIconKey;
  description?: string;
  visibility: NavigationItemVisibility;
  defaultRoles?: AppRole[];
  exposeWhenPermissions?: NavigationPermissionKey[];
  requireAnyPermission?: NavigationPermissionKey[];
  requireAllPermissions?: NavigationPermissionKey[];
  sortOrder: number;
};

export type ResolveNavigationInput = {
  pathname: string;
  lob: "FULFILLMENT" | "LOCATE";
  role: AppRole;
  isOwner?: boolean;
  isAdmin?: boolean;
  permissions?: string[];
  selectedOrgId?: string | null;
};

export type ResolvedNavigationItem = {
  key: NavigationItemKey;
  label: string;
  href: string;
  icon: NavigationIconKey;
  description?: string;
  active: boolean;
};

export type ResolvedNavigation = {
  role: AppRole;
  workspaceHomeHref: string;
  showOrgSelector: boolean;
  showLobSwitch: boolean;
  showAdmin: boolean;
  railItems: ResolvedNavigationItem[];
  accountItems: ResolvedNavigationItem[];
};