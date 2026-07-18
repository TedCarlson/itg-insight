// path: apps/web/src/app/(app)/schedule/page.tsx

import ScheduleSurface from "@/shared/schedule/surfaces/ScheduleSurface";
import { hasScheduleExceptionSubmitAccess } from "@/shared/access/scheduleExceptionSubmitAccess";
import { isTechExperienceUser } from "@/shared/access/access";
import { supabaseServer } from "@/shared/data/supabase/server";

import {
  loadScheduleSurfacePayload,
} from "@/shared/schedule/server/loadScheduleSurfacePayload.server";

type SearchParams = {
  pc_org_id?: string;
  start_date?: string;
  end_date?: string;
  view_mode?: "day" | "week" | "month" | "list";
  role_context?: "director" | "bp_owner" | "bp_lead" | "bp_supervisor";
  search?: string;
};

type Props = {
  searchParams?: Promise<SearchParams>;
};

export default async function Page({
  searchParams,
}: Props) {

  const params =
    await searchParams;

  const today =
    new Date().toISOString().slice(0, 10);

  const payload =
    await loadScheduleSurfacePayload({
      pcOrgId: params?.pc_org_id ?? null,
      supervisorAssignmentId: null,
      contractorId: null,
      startDate: params?.start_date ?? today,
      endDate: params?.end_date ?? today,
      viewMode: params?.view_mode ?? "day",
      roleContext: params?.role_context ?? null,
      search: params?.search ?? null,
    });

  let canSubmitExceptionRequest = false;

  const pcOrgId =
    String(payload.filters.pcOrgId ?? "").trim();

  if (pcOrgId) {
    const supabase =
      await supabaseServer();

    const { data: pass } =
      await supabase.rpc("get_access_pass", {
        p_pc_org_id: pcOrgId,
      });

    canSubmitExceptionRequest =
      !isTechExperienceUser(pass as any) &&
      hasScheduleExceptionSubmitAccess(pass as any);
  }

  return (
    <main className="p-4 md:p-6">
      <ScheduleSurface
        payload={payload}
        canSubmitExceptionRequest={canSubmitExceptionRequest}
      />
    </main>
  );
}
