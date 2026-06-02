"use client";

import { useRouter } from "next/navigation";
import { PeopleEditorDrawer, type PeopleEditorRow } from "./PeopleEditorDrawer";
import { Card } from "@/components/ui/Card";

type AffiliationOption = {
  affiliation_id: string;
  affiliation_label: string;
};

type Props = {
  person: PeopleEditorRow | null;
  error?: string | null;
  returnTo?: string;
  affiliations?: AffiliationOption[];
};

export function PersonRecordClient({
  person,
  error,
  returnTo = "/company-manager/people",
  affiliations = [],
}: Props) {
  const router = useRouter();

  function goBack() {
    router.push(returnTo);
    router.refresh();
  }

  function goBackAfterSave() {
    const separator = returnTo.includes("?") ? "&" : "?";
    router.push(`${returnTo}${separator}updated=${Date.now()}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              People
            </div>
            <h1 className="mt-1 text-xl font-semibold">Person Record</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit identity, contact, and onboarding fields for this person.
            </p>
          </div>

          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            {returnTo.includes("workforce") ? "Back to Workforce" : "Back to People"}
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_8%,white)] p-3 text-xs">
            {error}
          </div>
        ) : null}

        {!person && !error ? (
          <div className="mt-3 text-sm text-muted-foreground">
            Person not found.
          </div>
        ) : null}
      </Card>

      <PeopleEditorDrawer
        person={person}
        onClose={goBack}
        onSaved={goBackAfterSave}
        affiliations={affiliations}
      />
    </div>
  );
}