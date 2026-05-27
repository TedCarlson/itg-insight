export type ExceptionType =
  | "VACATION"
  | "PERSONAL_DAY"
  | "FMLA"
  | "ADD_DAY"
  | "COVERAGE_ADD"
  | string;

export type ImpactState = "SAFE" | "TIGHT" | "RISK";

export type RouteLockDay = {
  date: string;
  quota_routes: number | null;
  scheduled_routes: number;
  delta_forecast: number | null;
};

export type DraftExceptionRow = {
  date: string;
  type: ExceptionType;
  force_off?: boolean | null;
};

export type ExceptionImpact = {
  date: string;
  current_delta: number | null;
  projected_delta: number | null;
  impact_change: number | null;
  state: ImpactState;
};

function removesCapacity(row: DraftExceptionRow) {
  if (row.force_off) return true;

  const type = row.type?.toUpperCase();

  return type === "VACATION" || type === "PERSONAL_DAY" || type === "FMLA";
}

function addsCapacity(row: DraftExceptionRow) {
  const type = row.type?.toUpperCase();

  return type === "ADD_DAY" || type === "COVERAGE_ADD";
}

function deriveState(delta: number | null): ImpactState {
  if (delta === null) return "TIGHT";
  if (delta < 0) return "RISK";
  if (delta <= 1) return "TIGHT";
  return "SAFE";
}

function deriveCurrentDelta(day: RouteLockDay): number | null {
  if (typeof day.delta_forecast === "number" && Number.isFinite(day.delta_forecast)) {
    return day.delta_forecast;
  }

  if (
    typeof day.scheduled_routes === "number" &&
    Number.isFinite(day.scheduled_routes) &&
    typeof day.quota_routes === "number" &&
    Number.isFinite(day.quota_routes)
  ) {
    return day.scheduled_routes - day.quota_routes;
  }

  return null;
}

export function computeExceptionImpact(
  day: RouteLockDay,
  row: DraftExceptionRow
): ExceptionImpact {
  const currentDelta = deriveCurrentDelta(day);

  let projectedDelta = currentDelta;

  if (currentDelta !== null) {
    if (removesCapacity(row)) projectedDelta = currentDelta - 1;
    else if (addsCapacity(row)) projectedDelta = currentDelta + 1;
  }

  return {
    date: row.date,
    current_delta: currentDelta,
    projected_delta: projectedDelta,
    impact_change:
      currentDelta !== null && projectedDelta !== null ? projectedDelta - currentDelta : null,
    state: deriveState(projectedDelta),
  };
}
