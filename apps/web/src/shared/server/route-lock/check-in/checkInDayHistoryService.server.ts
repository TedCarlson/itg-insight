// path: apps/web/src/shared/server/route-lock/check-in/checkInDayHistoryService.server.ts

function asDateOnly(v: unknown) {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function asUuidOrRaw(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;

  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(s)
      ? s
      : null;

  return uuid ?? s;
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

function round2(n: number) {
  return Math.round(n * 100) / 100;
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
  shiftDate: string | null;
};

export async function getTechCheckInDayHistory(input: Input) {
  const assignmentId = asUuidOrRaw(input.assignmentId);
  const shiftDate = asDateOnly(input.shiftDate);

  if (!assignmentId) badRequest("Missing/invalid assignment_id");
  if (!shiftDate) badRequest("Missing/invalid shift_date");

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

  const { data: jobRows, error: jobErr } = await input.admin
    .from("check_in_job_row")
    .select(
      [
        "cp_date",
        "tech_id",
        "job_num",
        "work_order_number",
        "job_type",
        "job_units",
        "start_time",
        "cp_time",
        "job_duration",
        "is_sla_bptrl",
        "source_tech_last_name",
      ].join(",")
    )
    .eq("pc_org_id", input.pcOrgId)
    .eq("tech_id", techId)
    .eq("cp_date", shiftDate)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("cp_time", { ascending: true, nullsFirst: false });

  if (jobErr) serverError(jobErr.message);

  const sortedRows = [...(jobRows ?? [])].sort((a: any, b: any) => {
    const aStart = String(a.start_time ?? "99:99:99");
    const bStart = String(b.start_time ?? "99:99:99");
    return aStart.localeCompare(bStart);
  });

  const rows = sortedRows.map((row: any, index: number) => {
    const previous = index > 0 ? sortedRows[index - 1] : null;

    const previousCp = previous ? timeToMinutes(String(previous.cp_time ?? "")) : null;
    const currentStart = timeToMinutes(String(row.start_time ?? ""));

    const betweenJobMinutes =
      previousCp !== null && currentStart !== null && currentStart >= previousCp
        ? currentStart - previousCp
        : null;

    return {
      shift_date: String(row.cp_date ?? shiftDate),
      tech_id: String(row.tech_id ?? techId),

      job_num: String(row.job_num ?? ""),
      work_order_number: row.work_order_number ? String(row.work_order_number) : null,

      job_type: row.job_type ? String(row.job_type) : null,
      job_units: Number(row.job_units ?? 0) || 0,

      start_time: row.start_time ? String(row.start_time) : null,
      cp_time: row.cp_time ? String(row.cp_time) : null,

      job_duration: Number(row.job_duration ?? 0) || 0,

      is_sla_bptrl: Boolean(row.is_sla_bptrl),
      source_tech_last_name: row.source_tech_last_name ? String(row.source_tech_last_name) : null,

      between_job_minutes: betweenJobMinutes,
    };
  });

  const totalJobs = rows.length;
  const totalUnits = rows.reduce((sum, row) => sum + row.job_units, 0);
  const totalHours = rows.reduce((sum, row) => sum + row.job_duration, 0);
  const slaJobs = rows.filter((row) => row.is_sla_bptrl).length;

  const betweenValues = rows
    .map((row) => row.between_job_minutes)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const avgMinutesBetweenJobs =
    betweenValues.length > 0
      ? round2(betweenValues.reduce((sum, value) => sum + value, 0) / betweenValues.length)
      : null;

  return {
    ok: true,
    tech: {
      assignment_id: String(assignmentId),
      tech_id: techId,
      full_name: String(techRow.full_name ?? ""),
      affiliation: derivedAffiliation,
    },
    shift_date: shiftDate,
    summary: {
      total_jobs: totalJobs,
      total_units: round2(totalUnits),
      total_hours: round2(totalHours),
      sla_jobs: slaJobs,
      avg_units_per_job: totalJobs > 0 ? round2(totalUnits / totalJobs) : 0,
      avg_minutes_between_jobs: avgMinutesBetweenJobs,
    },
    rows,
  };
}