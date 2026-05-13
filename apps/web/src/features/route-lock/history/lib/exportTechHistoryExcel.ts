// path: apps/web/src/features/route-lock/history/lib/exportTechHistoryExcel.ts

import * as XLSX from "xlsx";
import type { CheckInWeeklyRow } from "./history.types";
import { buildTechHistoryExportFilename } from "./buildTechHistoryExportFilename";

function formatDecimal(value: number, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

export function exportTechHistoryExcel(input: {
  selectedTechLabel: string | null;
  selectedAffiliation: string | null;
  fromDate: string;
  toDate: string;
  rows: CheckInWeeklyRow[];
}) {
  const wb = XLSX.utils.book_new();

  const weeklyRows = input.rows.map((row) => ({
    Week: `Wk ${row.calendar_week} / ${row.calendar_year}`,
    "Week Start": row.week_start,
    "Week End": row.week_ending_saturday,
    Technician: input.selectedTechLabel ?? row.full_name,
    Affiliation: input.selectedAffiliation ?? row.affiliation ?? "",
    Jobs: row.actual_jobs,
    Units: row.actual_units,
    Hours: formatDecimal(row.actual_hours),
    "Units/Hr": formatDecimal(row.units_per_hour),
    "SLA Jobs": row.sla_bptrl_jobs,
    "SLA Units": formatDecimal(row.sla_bptrl_units),
  }));


  const dailyRows = input.rows.flatMap((row) =>
    row.worked_date_details.map((day) => ({
      Day: day.shift_date,
      Weekday: day.weekday_label,
      Scheduled: day.is_scheduled ? "YES" : "NO",
      Worked: day.is_worked ? "YES" : "NO",
      Jobs: day.actual_jobs,
      Units: formatDecimal(day.actual_units),
      Hours: formatDecimal(day.actual_hours),
      "Units/Hr": formatDecimal(day.units_per_hour),
      "SLA Jobs": day.sla_bptrl_jobs,
      "SLA Units": formatDecimal(day.sla_bptrl_units),
      "Between Minutes": day.between_job_minutes,
      Signal: day.signal,
    }))
  );

  const jobRows = input.rows.flatMap((row) =>
    row.job_rows.map((job) => ({
      Day: job.shift_date,
      Weekday: job.weekday_label,
      "Job #": job.job_num,
      "Work Order": job.work_order_number ?? "",
      Type: job.job_type ?? "",
      Units: formatDecimal(job.job_units),
      Start: job.start_time ?? "",
      End: job.cp_time ?? "",
      Duration: formatDecimal(job.job_duration),
      "Between Minutes": job.between_job_minutes ?? "",
      SLA: job.is_sla_bptrl ? "YES" : "NO",
      "Source Last Name": job.source_tech_last_name ?? "",
    }))
  );

  const weeklySheet = XLSX.utils.json_to_sheet(weeklyRows);
  const dailySheet = XLSX.utils.json_to_sheet(dailyRows);
  const jobsSheet = XLSX.utils.json_to_sheet(jobRows);

  XLSX.utils.book_append_sheet(wb, weeklySheet, "Weekly Summary");
  XLSX.utils.book_append_sheet(wb, dailySheet, "Daily Summary");
  XLSX.utils.book_append_sheet(wb, jobsSheet, "Job Detail");

  const safeTech =
    (input.selectedTechLabel ?? "tech")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50) || "tech";

  const filename = `tech_route_history_${safeTech}_${input.fromDate}_to_${input.toDate}.xlsx`;

  XLSX.writeFile(wb, filename);
}