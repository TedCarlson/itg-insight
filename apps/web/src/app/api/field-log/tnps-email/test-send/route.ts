import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAccessPass } from "@/shared/access/requireAccessPass";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";
import { buildTnpsDigest } from "@/features/field-log/server/buildTnpsDigest.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  let digestId: string | null = null;
  try {
    const body = await req.json();
    const pcOrgId = String(body?.pcOrgId ?? "").trim();
    const reportIds = Array.isArray(body?.reportIds) ? body.reportIds.map(String) : [];
    if (!pcOrgId) return NextResponse.json({ ok: false, error: "pcOrgId is required." }, { status: 400 });
    await requireAccessPass(req, pcOrgId);

    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ ok: false, error: "Your user account has no email address." }, { status: 400 });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) return NextResponse.json({ ok: false, error: "Email delivery is not configured." }, { status: 500 });

    const digest = await buildTnpsDigest({ pcOrgId, reportIds });
    const { data: saved, error: saveError } = await admin.from("field_log_tnps_email_digest").insert({
      pc_org_id: pcOrgId,
      send_mode: "test",
      status: "pending",
      subject: `[TEST] ${digest.subject}`,
      to_emails: [user.email],
      html_body: digest.html,
      text_body: digest.text,
      requested_by_user_id: user.id,
      requested_by_email: user.email,
    }).select("digest_id").single();
    if (saveError || !saved) throw new Error(saveError?.message || "Failed to record test email.");
    digestId = saved.digest_id;

    const { error: itemError } = await admin.from("field_log_tnps_email_digest_item").insert(
      digest.records.map((record) => ({
        digest_id: digestId,
        report_id: record.report_id,
        report_updated_at: record.report_updated_at,
        record_snapshot: record,
      })),
    );
    if (itemError) throw new Error(itemError.message);

    const result = await new Resend(apiKey).emails.send({ from, to: [user.email], subject: `[TEST] ${digest.subject}`, html: digest.html, text: digest.text });
    if (result.error) throw new Error(result.error.message);

    await admin.from("field_log_tnps_email_digest").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.data?.id ?? null }).eq("digest_id", digestId);
    return NextResponse.json({ ok: true, email: user.email });
  } catch (error) {
    if (digestId) await admin.from("field_log_tnps_email_digest").update({ status: "failed", error_message: error instanceof Error ? error.message : "Test send failed." }).eq("digest_id", digestId);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Test send failed." }, { status: 500 });
  }
}
