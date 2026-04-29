// path: apps/web/src/app/(app)/company-manager/people/page.tsx

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { PeopleStagingClient } from "@/shared/surfaces/people/PeopleStagingClient";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompanyManagerPeoplePage() {
  const sb = await supabaseAdmin();

  const { data } = await sb.rpc("workforce_affiliation_options");

  const affiliations = ((data ?? []) as WorkforceAffiliationOption[]).map(
    (row) => ({
      affiliation_id: row.affiliation_id,
      affiliation_label: row.affiliation_label,
    })
  );

  return (
    <main className="p-6">
      <PeopleStagingClient affiliations={affiliations} />
    </main>
  );
}