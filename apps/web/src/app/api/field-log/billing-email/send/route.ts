import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";

export const runtime = "nodejs";

// TODO(report-email-config):
// Move report email routing into admin-controlled configuration before expanding
// automated report delivery beyond Field Log billing packets.
// Future shape:
// - report_key/category_key
// - to/cc/bcc recipients
// - from identity
// - enabled/disabled
// - duplicate policy
// - resend/manual resend permissions
const FALLBACK_BILLING_TO = "Comcast_Billing@itgcomm.com";
const PACKET_BUCKET = "field-log-billing-packets";

async function loadBillingRecipients(admin: any, pcOrgId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("field_log_billing_email_recipient")
    .select("email")
    .eq("pc_org_id", pcOrgId)
    .eq("enabled", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const emails: string[] = Array.from(
    new Set<string>((data ?? []).map((row: any) => String(row.email ?? "").trim()).filter(Boolean)),
  );

  return emails.length > 0 ? emails : [FALLBACK_BILLING_TO];
}

type SendMode = "auto" | "manual_resend";

type SendBody = {
  reportId?: string;
  categoryKey?: string;
  sendMode?: SendMode;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function packetPathFor(categoryKey: string) {
  if (categoryKey === "conduit_pull_install") {
    return "/api/field-log/conduit-pull/job-packet";
  }
  if (categoryKey === "new_drop") {
    return "/api/field-log/new-drop/job-packet";
  }
  if (categoryKey === "commercial_battery_billing") {
    return "/api/field-log/commercial-battery/job-packet";
  }
  return null;
}

function packetLabelFor(categoryKey: string) {
  if (categoryKey === "conduit_pull_install") return "Conduit Pull";
  if (categoryKey === "commercial_battery_billing") return "Commercial Battery";
  return "New Drop";
}

function filenameFromDisposition(value: string | null, fallback: string) {
  const match = String(value ?? "").match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

type BillingPacket = {
  buffer: Buffer;
  filename: string;
  sha256: string;
  sizeBytes: number;
  cacheHit: boolean;
};

function packetObjectPath(reportId: string, sourceUpdatedAt: string, sha256: string) {
  const version = sourceUpdatedAt.replace(/[^0-9]/g, "");
  return `billing-packets/${reportId}/${version}-${sha256.slice(0, 16)}.pdf`;
}

async function generatePacket(args: {
  origin: string;
  cookie: string;
  packetPath: string;
  reportId: string;
  categoryKey: string;
  jobNumber: string | null;
}) {
  const packetRes = await fetch(
    `${args.origin}${args.packetPath}?report_id=${encodeURIComponent(args.reportId)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: args.cookie ? { cookie: args.cookie } : undefined,
    },
  );

  if (!packetRes.ok) {
    let message = "Failed to generate billing packet PDF.";
    try {
      const errorJson = await packetRes.json();
      message = errorJson?.error || message;
    } catch {}
    throw new Error(message);
  }

  const buffer = Buffer.from(await packetRes.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const filename = filenameFromDisposition(
    packetRes.headers.get("content-disposition"),
    `${packetLabelFor(args.categoryKey).replace(/\s+/g, "")}_${args.jobNumber ?? args.reportId}.pdf`,
  );

  return { buffer, sha256, filename, sizeBytes: buffer.byteLength };
}

async function loadOrGeneratePacket(args: {
  admin: any;
  origin: string;
  cookie: string;
  packetPath: string;
  reportId: string;
  categoryKey: string;
  jobNumber: string | null;
  sourceUpdatedAt: string;
  requestedByUserId: string;
}): Promise<BillingPacket> {
  const { data: cached, error: cacheReadError } = await args.admin
    .from("field_log_billing_packet_cache")
    .select(
      "source_updated_at,storage_bucket,storage_path,packet_filename,packet_sha256,packet_size_bytes,generation_count",
    )
    .eq("report_id", args.reportId)
    .maybeSingle();

  if (cacheReadError) throw new Error(cacheReadError.message);

  if (
    cached &&
    new Date(cached.source_updated_at).getTime() === new Date(args.sourceUpdatedAt).getTime()
  ) {
    const { data: cachedFile, error: downloadError } = await args.admin.storage
      .from(cached.storage_bucket)
      .download(cached.storage_path);

    if (!downloadError && cachedFile) {
      const buffer = Buffer.from(await cachedFile.arrayBuffer());
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

      if (
        sha256 === cached.packet_sha256 &&
        buffer.byteLength === Number(cached.packet_size_bytes)
      ) {
        return {
          buffer,
          filename: cached.packet_filename,
          sha256,
          sizeBytes: buffer.byteLength,
          cacheHit: true,
        };
      }
    }
  }

  const generated = await generatePacket(args);
  const storagePath = packetObjectPath(
    args.reportId,
    args.sourceUpdatedAt,
    generated.sha256,
  );
  const { error: uploadError } = await args.admin.storage
    .from(PACKET_BUCKET)
    .upload(storagePath, generated.buffer, {
      contentType: "application/pdf",
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) throw new Error(`Failed to cache billing packet: ${uploadError.message}`);

  const previousGenerationCount = Number(cached?.generation_count ?? 0);
  const { error: cacheWriteError } = await args.admin
    .from("field_log_billing_packet_cache")
    .upsert(
      {
        report_id: args.reportId,
        category_key: args.categoryKey,
        source_updated_at: args.sourceUpdatedAt,
        storage_bucket: PACKET_BUCKET,
        storage_path: storagePath,
        packet_filename: generated.filename,
        packet_sha256: generated.sha256,
        packet_size_bytes: generated.sizeBytes,
        generated_at: new Date().toISOString(),
        generated_by_user_id: args.requestedByUserId,
        generation_count: previousGenerationCount + 1,
      },
      { onConflict: "report_id" },
    );

  if (cacheWriteError) throw new Error(`Failed to record billing packet cache: ${cacheWriteError.message}`);

  return { ...generated, cacheHit: false };
}

function hasManagerAccess(accessPass: any) {
  if (!accessPass) return false;
  if (accessPass.is_admin || accessPass.is_app_owner || accessPass.is_owner) return true;

  const role = String(accessPass.role ?? accessPass.role_key ?? "").toLowerCase();
  if (["manager", "supervisor", "itg supervisor", "director", "vp", "owner", "admin"].includes(role)) return true;

  const perms = Array.isArray(accessPass.permissions) ? accessPass.permissions : [];
  return (
    role.includes("supervisor") ||
    perms.includes("field_log_manage") ||
    perms.includes("leadership_manage") ||
    perms.includes("permissions_manage")
  );
}

async function insertLog(args: {
  reportId: string;
  categoryKey: string;
  jobNumber: string | null;
  sendMode: SendMode;
  status: "pending" | "sent" | "failed" | "skipped_duplicate";
  toEmail: string;
  backupEmail: string | null;
  requestedByUserId: string;
  requestedByEmail: string | null;
  packetFilename?: string | null;
  packetSha256?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}) {
  const admin = supabaseAdmin();

  return admin
    .from("field_log_billing_email_log")
    .insert({
      report_id: args.reportId,
      category_key: args.categoryKey,
      job_number: args.jobNumber,
      packet_filename: args.packetFilename ?? null,
      packet_sha256: args.packetSha256 ?? null,
      send_mode: args.sendMode,
      status: args.status,
      to_email: args.toEmail,
      backup_email: args.backupEmail,
      requested_by_user_id: args.requestedByUserId,
      requested_by_email: args.requestedByEmail,
      provider_message_id: args.providerMessageId ?? null,
      error_message: args.errorMessage ?? null,
      sent_at: args.sentAt ?? null,
    })
    .select("id")
    .single();
}

export async function POST(req: NextRequest) {
  let body: SendBody;

  try {
    body = (await req.json()) as SendBody;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  const reportId = body.reportId?.trim();
  const bodyCategoryKey = body.categoryKey?.trim();
  const sendMode: SendMode = body.sendMode === "manual_resend" ? "manual_resend" : "auto";

  if (!reportId) return json(400, { ok: false, error: "reportId is required." });

  const supabase = await supabaseServer();
  const admin = supabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return json(403, { ok: false, error: "Unauthorized." });

  const { data: report, error: reportError } = await admin
    .from("field_log_report")
    .select("report_id,pc_org_id,category_key,status,job_number,subject_full_name,subject_tech_id,approved_at,updated_at")
    .eq("report_id", reportId)
    .maybeSingle();

  if (reportError) return json(500, { ok: false, error: reportError.message });
  if (!report) return json(404, { ok: false, error: "Field Log report not found." });

  const categoryKey = String(report.category_key ?? "");
  if (bodyCategoryKey && bodyCategoryKey !== categoryKey) {
    return json(400, { ok: false, error: "categoryKey does not match report." });
  }

  const packetPath = packetPathFor(categoryKey);
  if (!packetPath) {
    return json(400, { ok: false, error: "This Field Log category does not support billing email." });
  }

  if (report.status !== "approved") {
    return json(400, { ok: false, error: "Only approved Field Logs can be reported to billing." });
  }

  let accessPass: any;
  try {
    accessPass = await requireAccessPass(req, String(report.pc_org_id));
  } catch (err: any) {
    return json(err?.status || 403, { ok: false, error: err?.message || "Forbidden." });
  }

  if (sendMode === "manual_resend" && !hasManagerAccess(accessPass)) {
    return json(403, { ok: false, error: "Only managers or ITG supervisors can manually resend billing packets." });
  }

  const { data: existingAutoSent, error: existingError } = await admin
    .from("field_log_billing_email_log")
    .select("id,sent_at,provider_message_id")
    .eq("report_id", reportId)
    .eq("category_key", categoryKey)
    .eq("send_mode", "auto")
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();

  if (existingError) return json(500, { ok: false, error: existingError.message });

  if (sendMode === "auto" && existingAutoSent) {
    await insertLog({
      reportId,
      categoryKey,
      jobNumber: report.job_number ?? null,
      sendMode,
      status: "skipped_duplicate",
      toEmail: FALLBACK_BILLING_TO,
      backupEmail: user.email ?? null,
      requestedByUserId: user.id,
      requestedByEmail: user.email ?? null,
      errorMessage: "Auto-send skipped because this report was already sent to billing.",
    });

    return json(200, {
      ok: true,
      skipped: true,
      status: "skipped_duplicate",
      message: "Billing email was already sent. Auto-send skipped.",
    });
  }

  const billingRecipients = await loadBillingRecipients(admin, String(report.pc_org_id));
  const primaryBillingRecipient = billingRecipients[0] ?? FALLBACK_BILLING_TO;
  const backupBillingRecipients = billingRecipients.slice(1);

  const pending = await insertLog({
    reportId,
    categoryKey,
    jobNumber: report.job_number ?? null,
    sendMode,
    status: "pending",
    toEmail: primaryBillingRecipient,
    backupEmail: backupBillingRecipients.join(",") || null,
    requestedByUserId: user.id,
    requestedByEmail: user.email ?? null,
  });

  if (pending.error || !pending.data?.id) {
    return json(500, {
      ok: false,
      error: pending.error?.message || "Failed to create billing email log.",
    });
  }

  const logId = pending.data.id;
  const origin = req.nextUrl.origin;
  const cookie = req.headers.get("cookie") ?? "";

  try {
    const packet = await loadOrGeneratePacket({
      admin,
      origin,
      cookie,
      packetPath,
      reportId,
      categoryKey,
      jobNumber: report.job_number ?? null,
      sourceUpdatedAt: report.updated_at,
      requestedByUserId: user.id,
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not configured.");
    }

    const from =
      process.env.FIELD_LOG_BILLING_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      "ITG Insight <no-reply@itgcomm.com>";

    const label = packetLabelFor(categoryKey);
    const subject = `${label} Billing Packet — Job ${report.job_number ?? reportId}`;

    const resend = new Resend(resendKey);
    const sendResult = await resend.emails.send({
      from,
      to: billingRecipients,
      cc: user.email ? [user.email] : undefined,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.45;">
          <h2>${label} Billing Packet</h2>
          <p>The approved Field Log billing packet is attached.</p>
          <ul>
            <li><strong>Job:</strong> ${report.job_number ?? "—"}</li>
            <li><strong>Technician:</strong> ${report.subject_tech_id ?? "—"} • ${report.subject_full_name ?? "Unknown Technician"}</li>
            <li><strong>Approved:</strong> ${report.approved_at ?? "—"}</li>
            <li><strong>Send mode:</strong> ${sendMode}</li>
          </ul>
        </div>
      `,
      attachments: [
        {
          filename: packet.filename,
          content: packet.buffer,
        },
      ],
    });

    if (sendResult.error) {
      throw new Error(sendResult.error.message || "Resend failed to send billing email.");
    }

    const providerMessageId = sendResult.data?.id ?? null;
    const sentAt = new Date().toISOString();

    const { error: updateError } = await admin
      .from("field_log_billing_email_log")
      .update({
        status: "sent",
        packet_filename: packet.filename,
        packet_sha256: packet.sha256,
        packet_size_bytes: packet.sizeBytes,
        packet_cache_hit: packet.cacheHit,
        provider_message_id: providerMessageId,
        sent_at: sentAt,
      })
      .eq("id", logId);

    if (updateError) throw new Error(updateError.message);

    return json(200, {
      ok: true,
      status: "sent",
      sendMode,
      providerMessageId,
      packetFilename: packet.filename,
      packetSizeBytes: packet.sizeBytes,
      packetCacheHit: packet.cacheHit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send billing email.";

    await admin
      .from("field_log_billing_email_log")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", logId);

    return json(500, { ok: false, error: message });
  }
}
