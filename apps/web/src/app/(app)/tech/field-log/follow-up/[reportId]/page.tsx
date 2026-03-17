// apps/web/src/app/(app)/tech/field-log/follow-up/[reportId]/page.tsx

import { notFound, redirect } from "next/navigation";
import { FieldLogRuntimeProvider } from "@/features/field-log/context/FieldLogRuntimeProvider";
import { FieldLogRuntimeGate } from "@/features/field-log/components/FieldLogRuntimeGate";
import FieldLogDraftClient from "@/features/field-log/pages/FieldLogDraftClient";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

export default async function TechFieldLogFollowupPage(props: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await props.params;

  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("field_log_get_report_detail", {
    p_report_id: reportId,
  });

  if (error || !data) {
    notFound();
  }

  const editable =
    data.status === "draft" ||
    (data.status === "tech_followup_required" && !!data.edit_unlocked);

  if (!editable) {
    redirect(`/tech/field-log/detail/${reportId}`);
  }

  return (
    <FieldLogRuntimeProvider>
      <FieldLogRuntimeGate>
        <FieldLogDraftClient
          reportId={data.report_id}
          categoryKey={data.category_key}
          subcategoryKey={data.subcategory_key ?? null}
          initialJobNumber={data.job_number ?? ""}
          initialJobType={data.job_type ?? null}
          initialStatus={data.status ?? "draft"}
          initialEditUnlocked={!!data.edit_unlocked}
          initialComment={data.comment ?? ""}
          initialEvidenceDeclared={data.evidence_declared ?? "none"}
          initialXmDeclared={!!data.xm_declared}
          initialPhotoCount={Number(data.photo_count ?? 0)}
          initialGpsLat={data.gps_lat ?? null}
          initialGpsLng={data.gps_lng ?? null}
          initialGpsAccuracyM={data.gps_accuracy_m ?? null}
          initialLocationCapturedAt={data.location_captured_at ?? null}
          completionHref="/tech/field-log"
        />
      </FieldLogRuntimeGate>
    </FieldLogRuntimeProvider>
  );
}