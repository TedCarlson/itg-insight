// path: apps/web/src/features/route-lock/history/lib/exportTechHistoryPdf.ts

import type { CheckInWeeklyRow } from "./history.types";
import { buildTechHistoryExportFilename } from "./buildTechHistoryExportFilename";

function escapeHtml(value: unknown) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDecimal(value: number, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits);
}

function formatNumber(value: number) {
    return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function formatShortDate(dateOnly: string) {
    const d = new Date(`${dateOnly}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateOnly;

    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    return `${mm}/${dd}`;
}

function formatHoursMinutes(hours: number) {
    if (!Number.isFinite(hours) || hours <= 0) return "—";

    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h <= 0) return `${m} min`;
    if (m <= 0) return `${h} hr`;

    return `${h} hr ${m} min`;
}

function dailyRows(row: CheckInWeeklyRow) {
    return row.worked_date_details
        .map(
            (day) => `
        <tr>
          <td>${escapeHtml(day.shift_date)}</td>
          <td>${escapeHtml(day.weekday_label)}</td>
          <td>${day.is_scheduled ? "YES" : "NO"}</td>
          <td>${day.is_worked ? "YES" : "NO"}</td>
          <td class="num">${formatNumber(day.actual_jobs)}</td>
          <td class="num">${formatDecimal(day.actual_units)}</td>
          <td class="num">${formatDecimal(day.actual_hours)}</td>
          <td class="num">${formatDecimal(day.units_per_hour)}</td>
          <td class="num">${formatNumber(day.sla_bptrl_jobs)}</td>
          <td class="num">${formatDecimal(day.sla_bptrl_units)}</td>
          <td class="num">${formatNumber(day.between_job_minutes)}</td>
          <td>${escapeHtml(day.signal)}</td>
        </tr>
      `,
        )
        .join("");
}

function jobRows(row: CheckInWeeklyRow) {
    return row.job_rows
        .map(
            (job) => `
        <tr>
          <td>${escapeHtml(job.shift_date)}</td>
          <td>${escapeHtml(job.weekday_label)}</td>
          <td>${escapeHtml(job.job_num)}</td>
          <td>${escapeHtml(job.work_order_number ?? "")}</td>
          <td>${escapeHtml(job.job_type ?? "")}</td>
          <td class="num">${formatDecimal(job.job_units)}</td>
          <td>${escapeHtml(job.start_time ?? "—")}</td>
          <td>${escapeHtml(job.cp_time ?? "—")}</td>
          <td class="num">${formatHoursMinutes(job.job_duration)}</td>
          <td class="num">${job.between_job_minutes === null
                    ? "—"
                    : `${formatNumber(job.between_job_minutes)} min`
                }</td>
          <td>${job.is_sla_bptrl ? "SLA" : "BAU"}</td>
        </tr>
      `,
        )
        .join("");
}

export function exportTechHistoryPdf(input: {
    selectedTechLabel: string | null;
    selectedAffiliation: string | null;
    fromDate: string;
    toDate: string;
    rows: CheckInWeeklyRow[];
}) {
    const primary = input.rows[0] ?? null;

    if (!primary) {
        window.alert("No report rows available to print.");
        return;
    }

    const fileName = buildTechHistoryExportFilename({
        techId: primary.tech_id,
        fullName: primary.full_name,
        fromDate: input.fromDate,
        toDate: input.toDate,
        extension: "xlsx",
    }); 

    const title = "Tech Route History";
    const techLabel = input.selectedTechLabel ?? primary.full_name;
    const affiliation = input.selectedAffiliation ?? primary.affiliation ?? "";
    const weekLabel = `${formatShortDate(input.fromDate)}–${formatShortDate(
        input.toDate,
    )}`;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(fileName.replace(/\.pdf$/i, ""))}</title>
  <style>
    @page { size: landscape; margin: 0.35in; }

    body {
      font-family: Arial, sans-serif;
      color: #111827;
      font-size: 11px;
      margin: 0;
      padding: 0;
    }

    h1 { margin: 0; font-size: 20px; }
    h2 { margin: 18px 0 8px; font-size: 14px; }

    .meta {
      margin-top: 4px;
      color: #6b7280;
      font-size: 11px;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin: 16px 0;
    }

    .tile {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 8px;
    }

    .label {
      color: #6b7280;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .value {
      margin-top: 4px;
      font-size: 16px;
      font-weight: 700;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }

    th,
    td {
      border: 1px solid #d1d5db;
      padding: 5px;
      vertical-align: top;
    }

    th {
      background: #f3f4f6;
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #4b5563;
    }

    tr { page-break-inside: avoid; }
    .num { text-align: right; white-space: nowrap; }
    .section { page-break-inside: avoid; }
    .jobs { font-size: 9px; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      ${escapeHtml(techLabel)}
      ${affiliation ? ` • ${escapeHtml(affiliation)}` : ""}
      • ${escapeHtml(weekLabel)}
    </div>
  </header>

  <section class="summary">
    <div class="tile"><div class="label">Jobs</div><div class="value">${formatNumber(primary.actual_jobs)}</div></div>
    <div class="tile"><div class="label">Units</div><div class="value">${formatDecimal(primary.actual_units)}</div></div>
    <div class="tile"><div class="label">Hours</div><div class="value">${formatDecimal(primary.actual_hours)}</div></div>
    <div class="tile"><div class="label">Units/Hr</div><div class="value">${formatDecimal(primary.units_per_hour)}</div></div>
    <div class="tile"><div class="label">SLA Jobs</div><div class="value">${formatNumber(primary.sla_bptrl_jobs)}</div></div>
    <div class="tile"><div class="label">SLA Units</div><div class="value">${formatDecimal(primary.sla_bptrl_units)}</div></div>
  </section>

  <section class="section">
    <h2>Daily Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Day</th>
          <th>Weekday</th>
          <th>Scheduled</th>
          <th>Worked</th>
          <th>Jobs</th>
          <th>Units</th>
          <th>Hours</th>
          <th>Units/Hr</th>
          <th>SLA Jobs</th>
          <th>SLA Units</th>
          <th>Between Min</th>
          <th>Signal</th>
        </tr>
      </thead>
      <tbody>${dailyRows(primary)}</tbody>
    </table>
  </section>

  <section>
    <h2>Job Detail</h2>
    <table class="jobs">
      <thead>
        <tr>
          <th>Day</th>
          <th>Weekday</th>
          <th>Job #</th>
          <th>Work Order</th>
          <th>Type</th>
          <th>Units</th>
          <th>Start</th>
          <th>End</th>
          <th>Duration</th>
          <th>Between</th>
          <th>Signal</th>
        </tr>
      </thead>
      <tbody>${jobRows(primary)}</tbody>
    </table>
  </section>

  <script>
    window.addEventListener("load", () => {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;

    const blob = new Blob([html], {
        type: "text/html;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");

    if (!win) {
        URL.revokeObjectURL(url);
        window.alert("Popup blocked. Allow popups to print this report.");
        return;
    }

    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 30_000);
}