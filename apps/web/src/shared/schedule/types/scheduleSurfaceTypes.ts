// path: apps/web/src/shared/schedule/types/scheduleSurfaceTypes.ts

export type ScheduleViewMode =
  | "day"
  | "week"
  | "month"
  | "list";

export type SchedulePhase =
  | "planned"
  | "built"
  | "actual"
  | "none";

export type ScheduleDispatchOverlay = {
  callOut: boolean;
  addIn: boolean;
  techMove: boolean;

  incidentCount: number;
  noteCount: number;

  capacityDeltaRoutes: number | null;

  latestNote: string | null;
};

export type ScheduleBaseSchedule = {
  scheduled: boolean;

  routeArea: string | null;

  startTime: string | null;
  endTime: string | null;

  source:
    | "baseline"
    | "day_fact"
    | "exception"
    | "none";
};

export type ScheduleRouteLockFacts = {
  phase: SchedulePhase;

  plannedUnits: number | null;
  builtUnits: number | null;
  actualUnits: number | null;

  hasShiftValidation: boolean;
  hasCheckIn: boolean;
};

export type ScheduleBlackoutRule = {
  blackoutRuleId: string;
  label: string;
  blackoutType: string;
  managerControlledRequestEntry: boolean;
  source: "holiday_baseline" | "blackout_rule";
  sourceHolidayId: string | null;
};

export type ScheduleBlackoutDay = {
  date: string;
  rules: ScheduleBlackoutRule[];
};

export type ScheduleSurfaceRow = {
  date: string;

  personId: string;
  assignmentId: string | null;

  techId: string | null;

  fullName: string;

  pcOrgId: string;
  pcOrgName: string | null;

  officeId: string | null;
  officeName: string | null;

  supervisorName: string | null;

  contractorId: string | null;
  contractorName: string | null;
  affiliationCode: string | null;
  affiliationName: string | null;

  baseSchedule: ScheduleBaseSchedule;

  routeLock: ScheduleRouteLockFacts;

  dispatch: ScheduleDispatchOverlay;
};

export type ScheduleSurfaceFilters = {
  pcOrgId?: string | null;

  supervisorAssignmentId?: string | null;

  contractorId?: string | null;

  startDate: string;
  endDate: string;

  viewMode: ScheduleViewMode;

  roleContext?: "director" | "bp_owner" | "bp_lead" | "bp_supervisor" | null;

  forceScope?: "TECH_SELF" | null;

  forceAssignmentIds?: string[] | null;

  search?: string | null;
};

export type ScheduleDailySummary = {
  date: string;

  scheduledCount: number;
  offCount: number;

  plannedRouteCount: number | null;
  plannedUnitCount: number | null;

  quotaRouteCount: number | null;
  quotaUnitCount: number | null;

  meetsLockSignal: "met" | "miss" | "watch" | "unknown";

  approvedTimeOffCount: number;
  pendingTimeOffCount: number;
  deniedTimeOffCount: number;

  callOutCount: number;
  addInCount: number;
  techMoveCount: number;
  incidentCount: number;
  noteCount: number;

  isFiscalMonthEnd: boolean;
  fiscalAnchorLabel: string | null;
};

export type ScheduleSurfaceSummary = {
  scheduledCount: number;
  offCount: number;
  callOutCount: number;
  addInCount: number;
  techMoveCount: number;
};

export type ScheduleSurfacePayload = {
  generatedAt: string;

  filters: ScheduleSurfaceFilters;

  summary: ScheduleSurfaceSummary;

  dailySummaries: ScheduleDailySummary[];

  rows: ScheduleSurfaceRow[];

  blackoutByDate: Record<string, ScheduleBlackoutDay>;
};
