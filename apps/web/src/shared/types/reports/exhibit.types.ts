// path: apps/web/src/shared/types/reports/exhibit.types.ts

export type ExhibitFiscalMonth = {
  fiscal_month_id: string;
  start_date: string;
  end_date: string;
  label: string;
};

/**
 * One unique tech with check-in activity (a day with actual_jobs > 0) inside
 * the fiscal month. Entity, title, and role are the values from the
 * assignment that covered that month, not today's roster.
 */
export type ExhibitTechRow = {
  tech_id: string;
  person_id: string | null;
  assignment_id: string | null;
  full_name: string | null;
  entity: string | null;
  position_title: string | null;
  role_type: string | null;
  days_worked: number;
  first_worked: string;
  last_worked: string;
};

export type ExhibitPayload = {
  fiscalMonths: ExhibitFiscalMonth[];
  fiscalMonth: ExhibitFiscalMonth;
  techs: ExhibitTechRow[];
};
