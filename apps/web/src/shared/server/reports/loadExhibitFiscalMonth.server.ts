// path: apps/web/src/shared/server/reports/loadExhibitFiscalMonth.server.ts

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { todayInNY } from "@/features/route-lock/calendar/lib/fiscalMonth";
import type {
  ExhibitFiscalMonth,
  ExhibitPayload,
  ExhibitTechRow,
} from "@/shared/types/reports/exhibit.types";

const PAGE_SIZE = 1000;
const FISCAL_MONTH_OPTIONS = 24;
const ID_CHUNK = 200;

type RosterRow = {
  assignment_id: string;
  person_id: string | null;
  tech_id: string | null;
  full_name: string | null;
  position_title: string | null;
  start_date: string | null;
  end_date: string | null;
  co_name: string | null;
};

type ProfileFactRow = {
  person_id: string;
  role_type: string | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  created_at: string | null;
};

function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next ? next : null;
}

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

function overlapsWindow(
  start: string | null,
  end: string | null,
  window: ExhibitFiscalMonth
) {
  const startOk = !start || start <= window.end_date;
  const endOk = !end || end >= window.start_date;
  return startOk && endOk;
}

function toFiscalMonth(row: any): ExhibitFiscalMonth {
  return {
    fiscal_month_id: String(row.fiscal_month_id),
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    label: String(row.label ?? row.month_key ?? row.start_date),
  };
}

async function loadFiscalMonths(
  admin: any,
  today: string
): Promise<ExhibitFiscalMonth[]> {
  const { data, error } = await admin
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label,month_key")
    .lte("start_date", today)
    .order("start_date", { ascending: false })
    .limit(FISCAL_MONTH_OPTIONS);

  if (error) throw new Error(error.message);

  return (data ?? []).map(toFiscalMonth);
}

/**
 * Worked days per tech, using the same rule as the check-in weekly history:
 * a day counts when check_in_day_fact.actual_jobs > 0.
 */
async function loadWorkedDays(
  admin: any,
  pcOrgId: string,
  window: ExhibitFiscalMonth
) {
  const daysByTech = new Map<string, Set<string>>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("check_in_day_fact")
      .select("tech_id,shift_date")
      .eq("pc_org_id", pcOrgId)
      .gte("shift_date", window.start_date)
      .lte("shift_date", window.end_date)
      .gt("actual_jobs", 0)
      .order("shift_date", { ascending: true })
      .order("tech_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const techId = clean(row.tech_id);
      const shiftDate = clean(row.shift_date);
      if (!techId || !shiftDate) continue;

      const days = daysByTech.get(techId) ?? new Set<string>();
      days.add(shiftDate);
      daysByTech.set(techId, days);
    }

    if ((data ?? []).length < PAGE_SIZE) break;
  }

  return daysByTech;
}

/**
 * People holds every tech, former and current, with their associations.
 * Resolve each tech_id to the assignment that covered the fiscal month.
 */
async function loadRosterByTech(
  admin: any,
  pcOrgId: string,
  techIds: string[],
  window: ExhibitFiscalMonth
) {
  const byTech = new Map<string, RosterRow>();

  for (const ids of chunk(techIds, ID_CHUNK)) {
    const { data, error } = await admin
      .from("route_lock_history_roster_v")
      .select(
        "assignment_id,person_id,tech_id,full_name,position_title,start_date,end_date,co_name"
      )
      .eq("pc_org_id", pcOrgId)
      .in("tech_id", ids);

    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as RosterRow[]) {
      const techId = clean(row.tech_id);
      if (!techId) continue;

      const current = byTech.get(techId);
      const rowCovers = overlapsWindow(row.start_date, row.end_date, window);
      const currentCovers = current
        ? overlapsWindow(current.start_date, current.end_date, window)
        : false;

      // Prefer an assignment that covers the month; among equals, the latest start.
      if (
        !current ||
        (rowCovers && !currentCovers) ||
        (rowCovers === currentCovers &&
          String(row.start_date ?? "") > String(current.start_date ?? ""))
      ) {
        byTech.set(techId, row);
      }
    }
  }

  return byTech;
}

async function loadRoleTypeByPerson(
  admin: any,
  pcOrgId: string,
  personIds: string[],
  window: ExhibitFiscalMonth
) {
  const byPerson = new Map<string, ProfileFactRow>();

  for (const ids of chunk(personIds, ID_CHUNK)) {
    const { data, error } = await admin
      .from("company_profile_fact")
      .select("person_id,role_type,effective_start_date,effective_end_date,created_at")
      .eq("pc_org_id", pcOrgId)
      .in("person_id", ids)
      .lte("effective_start_date", window.end_date);

    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as ProfileFactRow[]) {
      if (!overlapsWindow(row.effective_start_date, row.effective_end_date, window)) {
        continue;
      }

      const current = byPerson.get(row.person_id);
      const rowKey = `${row.effective_start_date ?? ""}|${row.created_at ?? ""}`;
      const currentKey = current
        ? `${current.effective_start_date ?? ""}|${current.created_at ?? ""}`
        : "";

      if (!current || rowKey > currentKey) byPerson.set(row.person_id, row);
    }
  }

  return byPerson;
}

export async function loadExhibitFiscalMonth(args: {
  pc_org_id: string;
  fiscal_month_id?: string | null;
}): Promise<ExhibitPayload> {
  const admin = supabaseAdmin();
  const fiscalMonths = await loadFiscalMonths(admin, todayInNY());

  if (fiscalMonths.length === 0) {
    throw new Error("No fiscal months found");
  }

  const fiscalMonth =
    fiscalMonths.find((month) => month.fiscal_month_id === args.fiscal_month_id) ??
    fiscalMonths[0];

  const daysByTech = await loadWorkedDays(admin, args.pc_org_id, fiscalMonth);
  const techIds = Array.from(daysByTech.keys());

  const rosterByTech = await loadRosterByTech(
    admin,
    args.pc_org_id,
    techIds,
    fiscalMonth
  );

  const personIds = Array.from(
    new Set(
      Array.from(rosterByTech.values())
        .map((row) => clean(row.person_id))
        .filter((value): value is string => Boolean(value))
    )
  );

  const roleByPerson = await loadRoleTypeByPerson(
    admin,
    args.pc_org_id,
    personIds,
    fiscalMonth
  );

  const techs: ExhibitTechRow[] = techIds.map((techId) => {
    const roster = rosterByTech.get(techId) ?? null;
    const personId = clean(roster?.person_id);
    const days = Array.from(daysByTech.get(techId) ?? []).sort();

    return {
      tech_id: techId,
      person_id: personId,
      assignment_id: clean(roster?.assignment_id),
      full_name: clean(roster?.full_name),
      entity: clean(roster?.co_name),
      position_title: clean(roster?.position_title),
      role_type: personId ? clean(roleByPerson.get(personId)?.role_type) : null,
      days_worked: days.length,
      first_worked: days[0] ?? "",
      last_worked: days[days.length - 1] ?? "",
    };
  });

  techs.sort((a, b) =>
    String(a.full_name ?? a.tech_id).localeCompare(String(b.full_name ?? b.tech_id))
  );

  return { fiscalMonths, fiscalMonth, techs };
}
