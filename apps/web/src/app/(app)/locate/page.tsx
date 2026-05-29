"use client";

import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { useOrg } from "@/state/org";

export default function LocateHomePage() {
  const { orgs, orgsLoading, orgsError, selectedOrgId } = useOrg();

  const orgCount = orgs?.length ?? 0;
  const selectedOrg = selectedOrgId
    ? (orgs ?? []).find((o: any) => String(o?.pc_org_id) === String(selectedOrgId))
    : null;

  return (
    <PageShell>
      <PageHeader
        title="Locate"
        subtitle="Global Locate workspace • PC selection optional"
      />

      {orgsError ? (
        <Card>
          <p className="text-sm text-[var(--to-danger)]">PC load error: {orgsError}</p>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <div className="text-[11px] text-[var(--to-ink-muted)]">Locate Scope</div>
          <div className="mt-1 text-base font-semibold">
            {selectedOrg?.pc_org_name ?? "Global Locate"}
          </div>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Locate can operate without a selected PC. Use PC, MSO, and State filters inside Locate tools as they come online.
          </p>
        </Card>

        <Card>
          <div className="text-[11px] text-[var(--to-ink-muted)]">Visible PCs</div>
          <div className="mt-1 text-2xl font-semibold">
            {orgsLoading ? "…" : orgCount}
          </div>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">
            This will reflect your global/admin Locate visibility once the org RPC branch is updated.
          </p>
        </Card>

        <Card>
          <div className="text-[11px] text-[var(--to-ink-muted)]">Current PC Selection</div>
          <div className="mt-1 text-base font-semibold">
            {selectedOrg?.pc_org_name ?? "None selected"}
          </div>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Selection is optional for Locate home. Downstream tools can request PC scope only when required.
          </p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="text-base font-semibold">Reporting</div>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Open Locate reporting tools, saved history, and progress reporting surfaces.
          </p>
          <Link
            href="/locate/reporting"
            className="mt-4 inline-flex rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
          >
            Open Reporting
          </Link>
        </Card>

        <Card>
          <div className="text-base font-semibold">Daily Log</div>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Existing Locate daily operational entry surface.
          </p>
          <Link
            href="/locate/daily-log"
            className="mt-4 inline-flex rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
          >
            Open Daily Log
          </Link>
        </Card>
      </div>
    </PageShell>
  );
}
