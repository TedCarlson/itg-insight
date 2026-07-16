import { supabaseAdmin } from "@/shared/data/supabase/admin";

const TNPS_KEYS = ["detractor_risk", "tnps_detractor", "tnps_passive"];

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function text(value: unknown) {
  const next = String(value ?? "").trim();
  return next || "—";
}

function label(value: unknown) {
  const next = text(value);
  if (next === "tnps_passive") return "Passive";
  if (next === "tnps_detractor") return "Detractor";
  if (next === "detractor_risk") return "Customer Risk";
  return next.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function canonical(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/technician comments?:|customer contact feedback:|lessons\s*\/\s*takeaways?:/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type TnpsDigestRecord = {
  report_id: string;
  report_updated_at: string;
  submitted_at: string | null;
  job_number: string;
  tech_id: string | null;
  technician: string | null;
  segment: string | null;
  job_type: string | null;
  case_status: string | null;
  technician_comments: string | null;
  customer_contact_feedback: string | null;
  lessons_takeaways: string | null;
  latest_action_note: string | null;
};

export async function buildTnpsDigest(args: { pcOrgId: string; reportIds: string[] }) {
  const admin = supabaseAdmin();
  const reportIds = Array.from(new Set(args.reportIds.filter(Boolean))).slice(0, 100);
  if (reportIds.length === 0) throw new Error("Select at least one tNPS record.");

  const { data: reports, error: reportError } = await admin
    .from("field_log_report")
    .select("report_id,pc_org_id,category_key,subcategory_key,job_number,job_type,subject_tech_id,subject_full_name,submitted_at,updated_at")
    .eq("pc_org_id", args.pcOrgId)
    .eq("category_key", "post_call")
    .in("subcategory_key", TNPS_KEYS)
    .in("report_id", reportIds);
  if (reportError) throw new Error(reportError.message);
  if ((reports ?? []).length !== reportIds.length) throw new Error("One or more selected records are unavailable.");

  const { data: details, error: detailError } = await admin
    .from("field_log_report_post_call")
    .select("report_id,case_status,technician_comments,customer_contact_feedback,lessons_takeaways")
    .in("report_id", reportIds);
  if (detailError) throw new Error(detailError.message);
  const inactiveIds = (details ?? [])
    .filter((row: any) => row.case_status === "closed" || row.case_status === "resolved")
    .map((row: any) => row.report_id);
  if (inactiveIds.length > 0) {
    throw new Error("One or more selected tNPS cases are closed and no longer email eligible. Refresh the queue.");
  }

  const { data: actions, error: actionError } = await admin
    .from("field_log_review_action")
    .select("report_id,action_at,note")
    .in("report_id", reportIds)
    .not("note", "is", null)
    .order("action_at", { ascending: false });
  if (actionError) throw new Error(actionError.message);

  const detailById = new Map((details ?? []).map((row: any) => [row.report_id, row]));
  const latestNoteById = new Map<string, string>();
  for (const action of actions ?? []) {
    if (!latestNoteById.has(action.report_id) && action.note?.trim()) {
      latestNoteById.set(action.report_id, action.note.trim());
    }
  }

  const records: TnpsDigestRecord[] = (reports ?? [])
    .map((report: any) => {
      const detail: any = detailById.get(report.report_id) ?? {};
      return {
        report_id: report.report_id,
        report_updated_at: report.updated_at,
        submitted_at: report.submitted_at,
        job_number: report.job_number,
        tech_id: report.subject_tech_id,
        technician: report.subject_full_name,
        segment: report.subcategory_key,
        job_type: report.job_type,
        case_status: detail.case_status,
        technician_comments: detail.technician_comments,
        customer_contact_feedback: detail.customer_contact_feedback,
        lessons_takeaways: detail.lessons_takeaways,
        latest_action_note: latestNoteById.get(report.report_id) ?? null,
      };
    })
    .sort((a, b) => new Date(b.report_updated_at).getTime() - new Date(a.report_updated_at).getTime());

  for (const record of records) {
    const normalizedAction = canonical(record.latest_action_note);
    const knownComments = [
      record.technician_comments,
      record.customer_contact_feedback,
      record.lessons_takeaways,
    ].map(canonical).filter(Boolean);
    const repeatsKnownContent = knownComments.length > 0 && knownComments.every((comment) => normalizedAction.includes(comment));
    if (!normalizedAction || knownComments.includes(normalizedAction) || repeatsKnownContent) {
      record.latest_action_note = null;
    }
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
  const touchLabel = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  const subject = `ITG tNPS Case Activity — ${dateLabel}`;
  const rowsHtml = records.map((record, index) => {
    const activity = [
      record.technician_comments && `Technician: ${record.technician_comments}`,
      record.customer_contact_feedback && `Customer contact: ${record.customer_contact_feedback}`,
      record.lessons_takeaways && `Takeaway: ${record.lessons_takeaways}`,
      record.latest_action_note && `Latest update: ${record.latest_action_note}`,
    ].filter(Boolean).join("<br>");
    const cell = "padding:10px 12px;border:1px solid #d9dee5;vertical-align:top;line-height:1.4;";
    const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
    const metadata = `<strong style="font-size:14px">${esc(record.job_number)}</strong><br><span style="color:#526071">${esc(record.tech_id)} · ${esc(record.technician)}</span><br><span style="color:#526071">${esc(label(record.segment))} · Last touch ${esc(touchLabel(record.report_updated_at))}</span>`;
    return `<tr style="background:${rowBackground}"><td style="${cell}overflow-wrap:anywhere">${metadata}</td><td style="${cell}overflow-wrap:anywhere;word-break:normal">${activity || "—"}</td></tr>`;
  }).join("");

  const heading = "padding:9px 12px;border:1px solid #cfd5dd;text-align:left;font-size:12px;line-height:1.25;";
  const html = `<div style="max-width:1000px;margin:0 auto;font-family:Arial,sans-serif;color:#172033;font-size:14px"><p>Team,</p><p>Below is ITG's current tNPS case activity record as of ${esc(dateLabel)}.</p><table role="presentation" style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:13px"><colgroup><col style="width:30%"><col style="width:70%"></colgroup><thead><tr style="background:#f3f5f8"><th style="${heading}">Case</th><th style="${heading}">Activity / Comments</th></tr></thead><tbody>${rowsHtml}</tbody></table><p style="margin-top:20px">Regards,<br>Integrated Tech Group</p></div>`;
  const plain = records.map((record) => [
    `${record.job_number} — ${text(record.technician)} (${text(record.tech_id)})`,
    `${label(record.segment)} · Last touch ${touchLabel(record.report_updated_at)}`,
    record.technician_comments && `Technician: ${record.technician_comments}`,
    record.customer_contact_feedback && `Customer contact: ${record.customer_contact_feedback}`,
    record.lessons_takeaways && `Takeaway: ${record.lessons_takeaways}`,
    record.latest_action_note && `Latest update: ${record.latest_action_note}`,
  ].filter(Boolean).join("\n")).join("\n\n");

  return { subject, html, text: `Team,\n\nBelow is ITG's current tNPS case activity record as of ${dateLabel}.\n\n${plain}\n\nRegards,\nIntegrated Tech Group`, records };
}
