import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { requireAccessPass } from "@/shared/access/requireAccessPass";

export const runtime = "nodejs";

type CreateDraftBody = {
  createdByUserId?: string;
  pcOrgId?: string;
  categoryKey?: string;
  subcategoryKey?: string | null;
  jobNumber?: string;
  jobType?: string | null;
  subjectPersonId?: string | null;
  subjectFullName?: string | null;
  subjectTechId?: string | null;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: CreateDraftBody;

  try {
    body = (await req.json()) as CreateDraftBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const createdByUserId = body.createdByUserId?.trim();
  const pcOrgId = body.pcOrgId?.trim();
  const categoryKey = body.categoryKey?.trim();
  const subcategoryKey = body.subcategoryKey?.trim() || null;
  const jobNumber = body.jobNumber?.trim();
  const jobType = body.jobType?.trim() || null;

  const subjectPersonId = body.subjectPersonId?.trim() || null;
  const subjectFullName = body.subjectFullName?.trim() || null;
  const subjectTechId = body.subjectTechId?.trim() || null;

  if (!createdByUserId) {
    return badRequest("createdByUserId is required.");
  }

  if (!pcOrgId) {
    return badRequest("pcOrgId is required.");
  }

  if (!categoryKey) {
    return badRequest("categoryKey is required.");
  }

  if (!jobNumber) {
    return badRequest("jobNumber is required.");
  }

  try {
    await requireAccessPass(req, pcOrgId);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Forbidden" },
      { status: err?.status || 403 },
    );
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_create_draft", {
    p_created_by_user_id: createdByUserId,
    p_pc_org_id: pcOrgId,
    p_category_key: categoryKey,
    p_subcategory_key: subcategoryKey,
    p_job_number: jobNumber,
    p_job_type: jobType,
    p_subject_person_id: subjectPersonId,
    p_subject_full_name: subjectFullName,
    p_subject_tech_id: subjectTechId,
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to create Field Log draft.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    reportId: data,
  });
}