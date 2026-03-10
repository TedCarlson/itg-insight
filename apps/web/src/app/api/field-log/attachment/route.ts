import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type AddAttachmentBody = {
  reportId?: string;
  photoLabelKey?: string | null;
  filePath?: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
};

type DeleteAttachmentBody = {
  attachmentId?: string;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: AddAttachmentBody;

  try {
    body = (await req.json()) as AddAttachmentBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = body.reportId?.trim();
  const filePath = body.filePath?.trim();

  if (!reportId) {
    return badRequest("reportId is required.");
  }

  if (!filePath) {
    return badRequest("filePath is required.");
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_add_attachment", {
    p_report_id: reportId,
    p_photo_label_key: body.photoLabelKey?.trim() || null,
    p_file_path: filePath,
    p_file_name: body.fileName?.trim() || null,
    p_mime_type: body.mimeType?.trim() || null,
    p_file_size_bytes: body.fileSizeBytes ?? null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to add attachment metadata." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest) {
  let body: DeleteAttachmentBody;

  try {
    body = (await req.json()) as DeleteAttachmentBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const attachmentId = body.attachmentId?.trim();
  if (!attachmentId) {
    return badRequest("attachmentId is required.");
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_soft_delete_attachment", {
    p_attachment_id: attachmentId,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to delete attachment metadata." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}