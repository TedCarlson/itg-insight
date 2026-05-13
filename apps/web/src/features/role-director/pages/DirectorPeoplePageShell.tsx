// path: apps/web/src/features/role-director/pages/DirectorPeoplePageShell.tsx

import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { DirectorWorkspaceSelector } from "@/shared/surfaces/navigation/DirectorWorkspaceSelector";
import { PeopleStagingClient } from "@/shared/surfaces/people/PeopleStagingClient";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";

export default async function DirectorPeoplePageShell() {
  const scope = await requireSelectedPcOrgServer();

  if (!scope.ok) {
    return (
      <PageShell>
        <DirectorWorkspaceSelector />

        <Card className="p-4">
          <div className="text-sm font-medium">No selected organization</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Select an organization to load the Director People workspace.
          </div>
        </Card>
      </PageShell>
    );
  }

  const sb = supabaseAdmin();

  const { data } = await sb.rpc("workforce_affiliation_options");

  const affiliations = ((data ?? []) as WorkforceAffiliationOption[]).map(
    (row) => ({
      affiliation_id: row.affiliation_id,
      affiliation_label: row.affiliation_label,
    })
  );

  return (
    <PageShell>
      <DirectorWorkspaceSelector />

      <div id="shell-role-hint" data-shell-role="DIRECTOR" className="hidden" />

      <div className="space-y-4">
        <Card className="p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            People
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Stage, repair, and review people records for the selected Director workspace.
          </div>
        </Card>

        <PeopleStagingClient affiliations={affiliations} />
      </div>
    </PageShell>
  );
}