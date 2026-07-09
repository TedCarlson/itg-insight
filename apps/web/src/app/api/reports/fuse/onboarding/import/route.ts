import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { supabaseServer } from "@/shared/data/supabase/server";

function cleanHeader(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeRows(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows.map((row) => {
    const next: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      next[cleanHeader(key)] = value;
    }

    return next;
  });
}

export async function POST(req: Request) {
  const userClient = await supabaseServer();
  const adminClient = supabaseAdmin();

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();

  const workbook = XLSX.read(bytes, {
    type: "array",
    cellDates: true,
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheetName || !sheet) {
    return NextResponse.json({ error: "No worksheets found" }, { status: 400 });
  }

  const rows = normalizeRows(sheet);

  const { data, error } = await adminClient.rpc(
    "fuse_onboarding_import_create_batch",
    {
      p_uploaded_by_auth_user_id: user.id,
      p_filename: file.name,
      p_sheet_name: sheetName,
      p_worksheet_count: workbook.SheetNames.length,
      p_row_count: rows.length,
      p_rows: rows,
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    batch_id: data,
    filename: file.name,
    sheet_name: sheetName,
    worksheet_count: workbook.SheetNames.length,
    row_count: rows.length,
  });
}
