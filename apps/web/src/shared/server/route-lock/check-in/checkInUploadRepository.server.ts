// path: apps/web/src/shared/server/route-lock/check-in/checkInUploadRepository.server.ts

import type { CheckInDayFactAgg, FiscalMonthRow, ParsedCheckInRow } from "./checkInUploadTypes";

export function dbErr(e: any) {
  if (!e) return null;

  return {
    message: String(e.message ?? e),
    details: e.details ?? null,
    hint: e.hint ?? null,
    code: e.code ?? null,
  };
}

export async function loadPcOrgFulfillmentCenter(admin: any, pcOrgId: string): Promise<number | null> {
  const { data, error } = await admin
    .from("pc_org")
    .select("fulfillment_center_id")
    .eq("pc_org_id", pcOrgId)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { status: 500, detail: dbErr(error) });

  return (data?.fulfillment_center_id as number | null) ?? null;
}

export async function loadFiscalMonthsForRange(
  admin: any,
  minCpDate: string,
  maxCpDate: string
): Promise<FiscalMonthRow[]> {
  const { data, error } = await admin
    .from("fiscal_month_dim")
    .select("fiscal_month_id,start_date,end_date,label")
    .lte("start_date", maxCpDate)
    .gte("end_date", minCpDate)
    .order("start_date", { ascending: true });

  if (error) {
    throw Object.assign(new Error("failed to resolve fiscal months"), {
      status: 500,
      detail: dbErr(error),
    });
  }

  return (data ?? []).map((m: any) => ({
    fiscal_month_id: String(m.fiscal_month_id),
    start_date: String(m.start_date),
    end_date: String(m.end_date),
    label: m.label === null || m.label === undefined ? null : String(m.label),
  }));
}

export async function createCheckInBatch(
  admin: any,
  input: {
    pcOrgId: string;
    fulfillmentCenterId: number;
    uploadedByAuthUserId: string;
    sourceFileName: string;
    sourceHash: string;
    rowCountTotal: number;
    minCpDate: string | null;
    maxCpDate: string | null;
  }
): Promise<string> {
  const { data, error } = await admin
    .from("check_in_batch")
    .insert({
      pc_org_id: input.pcOrgId,
      fulfillment_center_id: input.fulfillmentCenterId,
      uploaded_by_auth_user_id: input.uploadedByAuthUserId,
      source_file_name: input.sourceFileName,
      source_hash: input.sourceHash,
      row_count_total: input.rowCountTotal,
      row_count_loaded: 0,
      min_cp_date: input.minCpDate,
      max_cp_date: input.maxCpDate,
    })
    .select("check_in_batch_id")
    .maybeSingle();

  if (error || !data?.check_in_batch_id) {
    throw Object.assign(new Error("failed to create batch"), {
      status: 500,
      detail: dbErr(error),
    });
  }

  return String(data.check_in_batch_id);
}

export async function updateCheckInBatchLoaded(
  admin: any,
  input: {
    checkInBatchId: string;
    rowCountLoaded: number;
    minCpDate?: string | null;
    maxCpDate?: string | null;
  }
) {
  const patch: Record<string, unknown> = {
    row_count_loaded: input.rowCountLoaded,
  };

  if ("minCpDate" in input) patch.min_cp_date = input.minCpDate ?? null;
  if ("maxCpDate" in input) patch.max_cp_date = input.maxCpDate ?? null;

  const { error } = await admin
    .from("check_in_batch")
    .update(patch)
    .eq("check_in_batch_id", input.checkInBatchId);

  if (error) {
    throw Object.assign(new Error("failed to update batch"), {
      status: 500,
      detail: dbErr(error),
    });
  }
}

export async function upsertCheckInJobRows(
  admin: any,
  input: {
    pcOrgId: string;
    checkInBatchId: string;
    fulfillmentCenterId: number;
    rows: ParsedCheckInRow[];
  }
): Promise<number> {
  let loaded = 0;
  const chunkSize = 750;

  const jobRows = input.rows.map((r) => ({
    pc_org_id: input.pcOrgId,
    check_in_batch_id: input.checkInBatchId,
    fulfillment_center_id: input.fulfillmentCenterId,
    tech_id: r.tech_id,
    job_num: r.job_num,
    work_order_number: r.work_order_number,
    account: r.account,
    job_type: r.job_type,
    job_units: r.job_units,
    time_slot_start_time: r.time_slot_start_time,
    time_slot_end_time: r.time_slot_end_time,
    start_time: r.start_time,
    cp_date: r.cp_date,
    cp_time: r.cp_time,
    job_duration: r.job_duration_hours,
    resolution_code: r.resolution_code,
    job_comment: r.job_comment,
    source_tech_last_name: r.source_tech_last_name,
    is_sla_bptrl: r.is_sla_bptrl,
  }));

  for (let i = 0; i < jobRows.length; i += chunkSize) {
    const chunk = jobRows.slice(i, i + chunkSize);
    const { error } = await admin.from("check_in_job_row").upsert(chunk, {
      onConflict: "pc_org_id,job_num,cp_date,tech_id",
    });

    if (error) {
      await updateCheckInBatchLoaded(admin, {
        checkInBatchId: input.checkInBatchId,
        rowCountLoaded: loaded,
      });

      throw Object.assign(new Error("failed to upsert job rows"), {
        status: 500,
        detail: dbErr(error),
      });
    }

    loaded += chunk.length;
  }

  return loaded;
}

export async function upsertCheckInDayFacts(admin: any, dayFacts: CheckInDayFactAgg[]) {
  const rows = dayFacts.map((a) => ({
    pc_org_id: a.pc_org_id,
    shift_date: a.shift_date,
    tech_id: a.tech_id,
    fiscal_month_id: a.fiscal_month_id,
    fiscal_end_date: a.fiscal_end_date,
    fulfillment_center_id: a.fulfillment_center_id,
    actual_jobs: a.actual_jobs,
    actual_units: a.actual_units,
    actual_hours: a.actual_hours,
    sla_bptrl_jobs: a.sla_bptrl_jobs,
    sla_bptrl_units: a.sla_bptrl_units,
    sla_bptrl_hours: a.sla_bptrl_hours,
    first_start_time: a.first_start_time,
    last_cp_time: a.last_cp_time,
    updated_at: new Date().toISOString(),
  }));

  const chunkSize = 1000;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await admin.from("check_in_day_fact").upsert(chunk, {
      onConflict: "pc_org_id,shift_date,tech_id",
    });

    if (error) {
      throw Object.assign(new Error("failed to upsert day facts"), {
        status: 500,
        detail: {
          db_error: dbErr(error),
          onConflict: "pc_org_id,shift_date,tech_id",
          sample_rows: chunk.slice(0, 5),
        },
      });
    }
  }

  return rows.length;
}