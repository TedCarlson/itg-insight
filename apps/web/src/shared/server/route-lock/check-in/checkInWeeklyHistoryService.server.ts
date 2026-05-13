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

function addDays(dateOnly: string, days: number) {
  const d = new Date(`${dateOnly}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

function startOfWeekSunday(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return toDateOnly(d);
}

function getCalendarWeek(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00`);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - yearStart.getTime()) / 86400000) + 1;
  return Math.ceil((dayOfYear + yearStart.getDay()) / 7);
}

function weekdayLabel(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
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

function timeToMinutes(time: string | null) {
  if (!time) return null;

  const m = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  return hh * 60 + mm;
}

function betweenValuesForJobs(jobs: any[]) {
  const sorted = [...jobs].sort((a, b) => {
    const aStart = String(a.start_time ?? "99:99:99");
    const bStart = String(b.start_time ?? "99:99:99");
    return aStart.localeCompare(bStart);
  });

  return sorted.map((row, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;

    const previousCp = previous ? timeToMinutes(String(previous.cp_time ?? "")) : null;
    const currentStart = timeToMinutes(String(row.start_time ?? ""));

    return previousCp !== null && currentStart !== null && currentStart >= previousCp
      ? currentStart - previousCp
      : null;
  });
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

type FactRow = {
  shift_date: string;
  actual_jobs: number;
  actual_units: number;
  actual_hours: number;
  sla_bptrl_jobs: number;
  sla_bptrl_units: number;
  sla_bptrl_hours: number;
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

  const { data: factRowsRaw, error: factErr } = await input.admin
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
      ].join(",")
    )
    .eq("pc_org_id", input.pcOrgId)
    .eq("tech_id", techId)
    .gte("shift_date", from)
    .lte("shift_date", to)
    .order("shift_date", { ascending: true });

  if (factErr) serverError(factErr.message);

  const { data: jobRowsRaw, error: jobErr } = await input.admin
    .from("check_in_job_row")
    .select(
      [
        "cp_date",
        "tech_id",
        "job_num",
        "work_order_number",
        "job_type",
        "job_units",
        "resolution_code",
        "start_time",
        "cp_time",
        "job_duration",
        "is_sla_bptrl",
        "source_tech_last_name",
      ].join(",")
    )
    .eq("pc_org_id", input.pcOrgId)
    .eq("tech_id", techId)
    .gte("cp_date", from)
    .lte("cp_date", to)
    .order("cp_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("cp_time", { ascending: true, nullsFirst: false });

  if (jobErr) serverError(jobErr.message);

  const factsByDate = new Map<string, FactRow>();

  for (const row of factRowsRaw ?? []) {
    const shiftDate = String((row as any).shift_date ?? "").trim();
    if (!shiftDate) continue;

    factsByDate.set(shiftDate, {
      shift_date: shiftDate,
      actual_jobs: Number((row as any).actual_jobs ?? 0) || 0,
      actual_units: Number((row as any).actual_units ?? 0) || 0,
      actual_hours: Number((row as any).actual_hours ?? 0) || 0,
      sla_bptrl_jobs: Number((row as any).sla_bptrl_jobs ?? 0) || 0,
      sla_bptrl_units: Number((row as any).sla_bptrl_units ?? 0) || 0,
      sla_bptrl_hours: Number((row as any).sla_bptrl_hours ?? 0) || 0,
    });
  }

  const jobsByDate = new Map<string, any[]>();

  for (const row of jobRowsRaw ?? []) {
    const shiftDate = String((row as any).cp_date ?? "").trim();
    if (!shiftDate) continue;

    const list = jobsByDate.get(shiftDate) ?? [];
    list.push(row);
    jobsByDate.set(shiftDate, list);
  }

  const weekStart = startOfWeekSunday(from);
  const weekEnd = addDays(weekStart, 6);

  const daySummaries = Array.from({ length: 7 }).map((_, index) => {
    const shiftDate = addDays(weekStart, index);
    const fact = factsByDate.get(shiftDate);
    const jobs = jobsByDate.get(shiftDate) ?? [];

    const betweenValues = betweenValuesForJobs(jobs).filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value)
    );

    const betweenTotal = betweenValues.reduce((sum, value) => sum + value, 0);
    const avgBetween = betweenValues.length > 0 ? round2(betweenTotal / betweenValues.length) : null;

    const actualJobs = fact?.actual_jobs ?? 0;
    const actualUnits = fact?.actual_units ?? 0;
    const actualHours = fact?.actual_hours ?? 0;
    const slaJobs = fact?.sla_bptrl_jobs ?? 0;

    return {
      shift_date: shiftDate,
      weekday_label: weekdayLabel(shiftDate),
      is_scheduled: actualJobs > 0,
      is_worked: actualJobs > 0,
      actual_jobs: actualJobs,
      actual_units: actualUnits,
      actual_hours: actualHours,
      units_per_hour: actualHours > 0 ? round2(actualUnits / actualHours) : 0,
      sla_bptrl_jobs: slaJobs,
      sla_bptrl_units: fact?.sla_bptrl_units ?? 0,
      sla_bptrl_hours: fact?.sla_bptrl_hours ?? 0,
      between_job_minutes: betweenTotal,
      avg_between_job_minutes: avgBetween,
      signal: slaJobs > 0 ? "SLA" : actualJobs > 0 ? "PRODUCTION" : "OFF",
    };
  });

  const jobRows = Array.from(jobsByDate.entries()).flatMap(([shiftDate, jobs]) => {
    const sorted = [...jobs].sort((a, b) => {
      const aStart = String(a.start_time ?? "99:99:99");
      const bStart = String(b.start_time ?? "99:99:99");
      return aStart.localeCompare(bStart);
    });

    const betweenValues = betweenValuesForJobs(sorted);

    return sorted.map((row, index) => ({
      shift_date: shiftDate,
      weekday_label: weekdayLabel(shiftDate),
      tech_id: String(row.tech_id ?? techId),
      job_num: String(row.job_num ?? ""),
      work_order_number: row.work_order_number ? String(row.work_order_number) : null,
      job_type: row.job_type ? String(row.job_type) : null,
      job_units: Number(row.job_units ?? 0) || 0,
      resolution_code: row.resolution_code ? String(row.resolution_code) : null,
      start_time: row.start_time ? String(row.start_time) : null,
      cp_time: row.cp_time ? String(row.cp_time) : null,
      job_duration: Number(row.job_duration ?? 0) || 0,
      is_sla_bptrl: Boolean(row.is_sla_bptrl),
      source_tech_last_name: row.source_tech_last_name ? String(row.source_tech_last_name) : null,
      between_job_minutes: betweenValues[index] ?? null,
    }));
  });

  const actualJobs = daySummaries.reduce((sum, row) => sum + row.actual_jobs, 0);
  const actualUnits = daySummaries.reduce((sum, row) => sum + row.actual_units, 0);
  const actualHours = daySummaries.reduce((sum, row) => sum + row.actual_hours, 0);
  const slaJobs = daySummaries.reduce((sum, row) => sum + row.sla_bptrl_jobs, 0);
  const slaUnits = daySummaries.reduce((sum, row) => sum + row.sla_bptrl_units, 0);
  const slaHours = daySummaries.reduce((sum, row) => sum + row.sla_bptrl_hours, 0);
  const workedDates = daySummaries.filter((row) => row.actual_jobs > 0).map((row) => row.shift_date);

  const row = {
    assignment_id: String(assignmentId),
    week_start: weekStart,
    week_end: weekEnd,
    week_ending_saturday: weekEnd,
    calendar_year: Number(weekEnd.slice(0, 4)),
    calendar_week: getCalendarWeek(weekEnd),
    tech_id: techId,
    full_name: String(techRow.full_name ?? ""),
    affiliation: derivedAffiliation,
    days_worked: workedDates.length,
    worked_dates: workedDates,
    worked_dates_label: workedDates.join(", "),
    worked_date_details: daySummaries,
    actual_jobs: actualJobs,
    actual_units: actualUnits,
    actual_hours: actualHours,
    jobs_per_day: workedDates.length > 0 ? round2(actualJobs / workedDates.length) : 0,
    units_per_day: workedDates.length > 0 ? round2(actualUnits / workedDates.length) : 0,
    hours_per_day: workedDates.length > 0 ? round2(actualHours / workedDates.length) : 0,
    units_per_hour: actualHours > 0 ? round2(actualUnits / actualHours) : 0,
    sla_bptrl_jobs: slaJobs,
    sla_bptrl_units: slaUnits,
    sla_bptrl_hours: slaHours,
    sla_bptrl_jobs_per_day: workedDates.length > 0 ? round2(slaJobs / workedDates.length) : 0,
    sla_bptrl_units_per_day: workedDates.length > 0 ? round2(slaUnits / workedDates.length) : 0,
    sla_bptrl_hours_per_day: workedDates.length > 0 ? round2(slaHours / workedDates.length) : 0,
    job_rows: jobRows,
  };

  return {
    ok: true,
    tech: {
      assignment_id: String(assignmentId),
      tech_id: techId,
      full_name: String(techRow.full_name ?? ""),
      affiliation: derivedAffiliation,
    },
    window: { from, to },
    rows: [row],
  };
}