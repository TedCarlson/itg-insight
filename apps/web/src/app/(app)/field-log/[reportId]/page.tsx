import { notFound } from "next/navigation";
import { supabaseServer } from "@/shared/data/supabase/server";
import { FieldLogDetailClient } from "@/features/field-log/pages/FieldLogDetailClient";

export const runtime = "nodejs";

export default async function FieldLogDetailPage(props: {
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

  return <FieldLogDetailClient initialData={data} />;
}
