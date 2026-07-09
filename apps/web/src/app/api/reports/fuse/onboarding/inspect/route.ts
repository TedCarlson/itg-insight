import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseServer } from "@/shared/data/supabase/server";

export async function POST(req: Request) {
  const sb = await supabaseServer();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file" },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();

  const workbook = XLSX.read(bytes, {
    type: "array",
    cellDates: true,
  });

  const worksheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];

    const preview = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    }).slice(0, 15);

    const rowCount = preview.length;

    const columnCount = preview.reduce<number>(
      (best, row) =>
        Array.isArray(row) ? Math.max(best, row.length) : best,
      0
    );

    return {
      name,
      rowCount,
      columnCount,
      preview,
    };
  });

  return NextResponse.json({
    workbook: file.name,
    worksheetCount: worksheets.length,
    worksheets,
  });
}
