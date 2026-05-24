// path: apps/web/src/app/(app)/schedule/page.tsx

import ScheduleSurface from "@/shared/schedule/surfaces/ScheduleSurface";

import {
  loadScheduleSurfacePayload,
} from "@/shared/schedule/server/loadScheduleSurfacePayload.server";

type SearchParams = {
  pc_org_id?: string;
  start_date?: string;
  end_date?: string;
  view_mode?: "day" | "week" | "month" | "list";
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
    });

  return (
    <main className="p-4 md:p-6">
      <ScheduleSurface payload={payload} />
    </main>
  );
}
