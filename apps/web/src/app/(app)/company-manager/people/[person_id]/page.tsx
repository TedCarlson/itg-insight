// path: apps/web/src/app/(app)/company-manager/people/[person_id]/page.tsx

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { PersonRecordClient } from "@/shared/surfaces/people/PersonRecordClient";
import type { PeopleEditorRow } from "@/shared/surfaces/people/PeopleEditorDrawer";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";

type Props = {
  params: Promise<{
    person_id: string;
  }>;
  searchParams?: Promise<{
    returnTo?: string;
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompanyManagerPersonRecordPage({
  params,
  searchParams,
}: Props) {
  const { person_id } = await params;
  const search = searchParams ? await searchParams : {};
  const returnTo = search.returnTo ?? "/company-manager/people";

  const sb = await supabaseAdmin();

  const [{ data, error }, { data: affiliationData, error: affiliationError }] =
    await Promise.all([
      sb.rpc("people_record_get", {
        p_person_id: person_id,
      }),
      sb.rpc("workforce_affiliation_options"),
    ]);

  const person = Array.isArray(data)
    ? (data[0] as PeopleEditorRow | undefined)
    : null;

  const affiliations = ((affiliationData ?? []) as WorkforceAffiliationOption[]).map(
    (row) => ({
      affiliation_id: row.affiliation_id,
      affiliation_label: row.affiliation_label,
    })
  );

  return (
    <main className="p-6">
      <PersonRecordClient
        person={person ?? null}
        error={error?.message ?? affiliationError?.message ?? null}
        returnTo={returnTo}
        affiliations={affiliations}
      />
    </main>
  );
}