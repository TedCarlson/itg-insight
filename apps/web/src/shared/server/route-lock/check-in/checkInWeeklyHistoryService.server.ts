// path: apps/web/src/shared/server/route-lock/check-in/checkInWeeklyHistoryService.server.ts

function asDateOnly(v: unknown) {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function asUuid(v: unknown) {
  const s = String(v ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeekSunday(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return toDateOnly(d);
}

function addDays(dateOnly: string, days: number) {
  const d = new Date(`${dateOnly}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

function getCalendarWeek(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00`);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - yearStart.getTime()) / 86400000) + 1;
  return Math.ceil((dayOfYear + yearStart.getDay()) / 7);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function notFound(message: string): never {
  throw Object.assign(new Error(message), { status: 404 });
}

function serverError(message: string, detail?: unknown): never {
  throw Object.assign(new Error(message), { status: 500, detail });
}

async function resolveAffiliationName(admin: any, personId: string | null) {
  if (!personId) return null;

  const { data: personRow, error: personErr } = await admin
    .from("person")
    .select("person_id,co_ref_id,co_code")
    .eq("person_id", personId)
    .maybeSingle();

  if (personErr || !personRow) return null;

  const coRefId = personRow.co_ref_id ? String(personRow.co_ref_id) : null;
  const coCode = personRow.co_code ? String(personRow.co_code) : null;

  if (coRefId) {
    const [{ data: company }, { data: contractor }] = await Promise.all([
      admin.from("company").select("company_name").eq("company_id", coRefId).maybeSingle(),
      admin.from("contractor").select("contractor_name").eq("contractor_id", coRefId).maybeSingle(),
    ]);

    if (company?.company_name) return String(company.company_name);
    if (contractor?.contractor_name) return String(contractor.contractor_name);
  }

  if (coCode) {
    const [{ data: companyByCode }, { data: contractorByCode }] = await Promise.all([
      admin.from("company").select("company_name").eq("company_code", coCode).maybeSingle(),
      admin.from("contractor").select("contractor_name").eq("contractor_code", coCode).maybeSingle(),
    ]);

    if (companyByCode?.company_name) return String(companyByCode.company_name);
    if (contractorByCode?.contractor_name) return String(contractorByCode.contractor_name);
  }

  return null;
}

type Input = {
  admin: any;
  pcOrgId: string;
  assignmentId: string | null;
  from: string | null;
  to: string | null;
};

export async function getTechCheckInWeeklyHistory(input: Input) {
  const assignmentIdRaw = String(input.assignmentId ?? "").trim();
  const assignmentId = asUuid(assignmentIdRaw) ?? assignmentIdRaw;
  const from = asDateOnly(input.from);
  const to = asDateOnly(input.to);

  if (!assignmentId) badRequest("Missing/invalid assignment_id");
  if (!from || !to) badRequest("Missing/invalid from/to date");
  if (from > to) badRequest("from date cannot be after to date");

  const { data: techRow, error: techErr } = await input.admin
    .from("route_lock_roster_v")
    .select("assignment_id,person_id,tech_id,full_name,co_name")
    .eq("pc_org_id", input.pcOrgId)
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (techErr) serverError(techErr.message);
  if (!techRow) notFound("Technician assignment not found in selected org");

  const techId = String(techRow.tech_id ?? "").trim();
  if (!techId) badRequest("Selected tech has no tech_id");

  const personId = techRow.person_id ? String(techRow.person_id) : null;
  const derivedAffiliation =
    (techRow.co_name ? String(techRow.co_name) : null) ??
    (await resolveAffiliationName(input.admin, personId));

  const { data: factRows, error: factErr } = await input.admin
    .from("check_in_day_fact")
    .select(
      [
        "shift_date",
        "actual_jobs",
        "actual_units",
        "actual_hours",
        "sla_bptrl_jobs",
        "sla_bptrl_units",
        "sla_bptrl_hours",
        "tech_id",
      ].join(",")
    )
    .eq("pc_org_id", input.pcOrgId)
    .eq("tech_id", techId)
    .gte("shift_date", from)
    .lte("shift_date", to)
    .order("shift_date", { ascending: true });

  if (factErr) serverError(factErr.message);

  const weekMap = new Map<
    string,
    {
      assignment_id: string;
      week_start: string;
      week_end: string;
      week_ending_saturday: string;
      calendar_year: number;
      calendar_week: number;
      tech_id: string;
      full_name: string;
      affiliation: string | null;
      days_worked: number;
      worked_dates: string[];
      worked_date_details: {
        shift_date: string;
        sla_bptrl_jobs: number;
      }[];
      actual_jobs: number;
      actual_units: number;
      actual_hours: number;
      sla_bptrl_jobs: number;
      sla_bptrl_units: number;
      sla_bptrl_hours: number;
    }
  >();

  for (const row of factRows ?? []) {
    const shiftDate = String((row as any).shift_date ?? "").trim();
    if (!shiftDate) continue;

    const weekStart = startOfWeekSunday(shiftDate);
    const weekEnd = addDays(weekStart, 6);
    const key = weekStart;

    const cur = weekMap.get(key) ?? {
      assignment_id: String(assignmentId),
      week_start: weekStart,
      week_end: weekEnd,
      week_ending_saturday: weekEnd,
      calendar_year: Number(weekEnd.slice(0, 4)),
      calendar_week: getCalendarWeek(weekEnd),
      tech_id: techId,
      full_name: String(techRow.full_name ?? ""),
      affiliation: derivedAffiliation,
      days_worked: 0,
      worked_dates: [],
      worked_date_details: [],
      actual_jobs: 0,
      actual_units: 0,
      actual_hours: 0,
      sla_bptrl_jobs: 0,
      sla_bptrl_units: 0,
      sla_bptrl_hours: 0,
    };

    const actualJobs = Number((row as any).actual_jobs ?? 0) || 0;
    const actualUnits = Number((row as any).actual_units ?? 0) || 0;
    const actualHours = Number((row as any).actual_hours ?? 0) || 0;
    const slaJobs = Number((row as any).sla_bptrl_jobs ?? 0) || 0;
    const slaUnits = Number((row as any).sla_bptrl_units ?? 0) || 0;
    const slaHours = Number((row as any).sla_bptrl_hours ?? 0) || 0;

    cur.days_worked += 1;
    cur.worked_dates.push(shiftDate);
    cur.worked_date_details.push({
      shift_date: shiftDate,
      sla_bptrl_jobs: slaJobs,
    });

    cur.actual_jobs += actualJobs;
    cur.actual_units += actualUnits;
    cur.actual_hours += actualHours;
    cur.sla_bptrl_jobs += slaJobs;
    cur.sla_bptrl_units += slaUnits;
    cur.sla_bptrl_hours += slaHours;

    weekMap.set(key, cur);
  }

  const rows = Array.from(weekMap.values())
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((row) => {
      const days = row.days_worked || 0;
      const hours = row.actual_hours || 0;

      return {
        ...row,
        worked_dates_label: row.worked_dates.join(", "),
        jobs_per_day: days > 0 ? round2(row.actual_jobs / days) : 0,
        units_per_day: days > 0 ? round2(row.actual_units / days) : 0,
        hours_per_day: days > 0 ? round2(row.actual_hours / days) : 0,
        units_per_hour: hours > 0 ? round2(row.actual_units / hours) : 0,
        sla_bptrl_jobs_per_day: days > 0 ? round2(row.sla_bptrl_jobs / days) : 0,
        sla_bptrl_units_per_day: days > 0 ? round2(row.sla_bptrl_units / days) : 0,
        sla_bptrl_hours_per_day: days > 0 ? round2(row.sla_bptrl_hours / days) : 0,
      };
    });

  return {
    ok: true,
    tech: {
      assignment_id: assignmentId,
      tech_id: techId,
      full_name: String(techRow.full_name ?? ""),
      affiliation: derivedAffiliation,
    },
    window: { from, to },
    rows,
  };
}