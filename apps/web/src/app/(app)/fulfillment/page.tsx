"use client";

import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { useOrg } from "@/state/org";
import { useHomeBlocks } from "@/features/home/useHomeBlocks";
import { HomeBlocks } from "@/features/home/HomeBlocks";

export default function FulfillmentHomePage() {
  const { orgs, orgsLoading, orgsError, selectedOrgId } = useOrg();
  const { loading: blocksLoading, error: blocksError, byArea } = useHomeBlocks("FULFILLMENT");

  const hasOrgs = (orgs ?? []).length > 0;
  const isScoped = !!selectedOrgId;

  const blocked = !orgsLoading && hasOrgs && !isScoped;
  const noOrgsYet = !orgsLoading && !orgsError && !hasOrgs;

  const selectedOrg = isScoped
    ? (orgs ?? []).find((o: any) => String(o?.pc_org_id) === String(selectedOrgId))
    : null;

  return (
    <PageShell>
      <PageHeader title="Fulfillment" subtitle="PC home • report surface • blocks per org" />

      {orgsError ? (
        <Card>
          <p className="text-sm text-[var(--to-danger)]">PC load error: {orgsError}</p>
        </Card>
      ) : orgsLoading ? (
        <Card>
          <p className="text-sm text-[var(--to-ink-muted)]">Loading PC scope…</p>
        </Card>
      ) : noOrgsYet ? (
        <Card>
          <p className="text-sm text-[var(--to-ink-muted)]">
            No Fulfillment PCs are available for your user yet. If this is unexpected, contact an admin.
          </p>
        </Card>
      ) : blocked ? (
        <Card>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Select a <span className="font-medium">PC</span> in the left rail to load your Fulfillment homepage.
          </p>
        </Card>
      ) : null}

      <Card>
        <div className="text-[11px] text-[var(--to-ink-muted)]">Current PC</div>
        <div className="mt-1 text-base font-semibold">
          {selectedOrg?.pc_org_name ?? (isScoped ? "Selected PC" : "No PC Selected")}
        </div>
        {isScoped ? <div className="mt-1 text-[11px] text-[var(--to-ink-muted)]">pc_org_id: {selectedOrgId}</div> : null}
      </Card>

      {isScoped ? (
        blocksError ? (
          <Card>
            <p className="text-sm text-[var(--to-danger)]">Home blocks error: {blocksError}</p>
          </Card>
        ) : blocksLoading ? (
          <Card>
            <p className="text-sm text-[var(--to-ink-muted)]">Loading homepage blocks…</p>
          </Card>
        ) : (
          <>
            {/* Optional areas, rendered in order */}
            {byArea.header?.length ? <HomeBlocks blocks={byArea.header} /> : null}

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="grid gap-3">
                {byArea.kpis?.length ? <HomeBlocks blocks={byArea.kpis} /> : null}
                {byArea.left?.length ? <HomeBlocks blocks={byArea.left} /> : null}
              </div>
              <div className="grid gap-3">
                {byArea.right?.length ? <HomeBlocks blocks={byArea.right} /> : null}
              </div>
            </div>

            {byArea.footer?.length ? <HomeBlocks blocks={byArea.footer} /> : null}

            {!Object.keys(byArea).length ? (
              <Card>
                <p className="text-sm text-[var(--to-ink-muted)]">
                  No homepage blocks configured for this PC yet. Seed rows in <code>pc_org_home_block</code>.
                </p>
              </Card>
            ) : null}
          </>
        )
      ) : null}
    </PageShell>
  );
}