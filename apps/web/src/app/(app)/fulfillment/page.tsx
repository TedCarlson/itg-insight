"use client";

import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { useOrg } from "@/state/org";
import { useDispatchConsoleAccess } from "../../../hooks/useDispatchConsoleAccess";

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function DisabledTile({ label, reason }: { label: string; reason: string }) {
  return (
    <div
      className={cls("to-btn", "to-btn--secondary", "px-4 py-3", "text-center", "opacity-60", "cursor-not-allowed")}
      aria-disabled
      title={reason}
    >
      {label}
    </div>
  );
}

export default function FulfillmentHomePage() {
  const { orgs, orgsLoading, orgsError, selectedOrgId } = useOrg();
  const { loading: dcLoading, allowed: dcAllowed } = useDispatchConsoleAccess();

  const hasOrgs = (orgs ?? []).length > 0;
  const isScoped = !!selectedOrgId;

  const blocked = !orgsLoading && hasOrgs && !isScoped;
  const noOrgsYet = !orgsLoading && !orgsError && !hasOrgs;

  return (
    <PageShell>
      <PageHeader title="Fulfillment" subtitle="Roster Management • Route Lock Planning • Metrics Visibility" />

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
            Select a <span className="font-medium">PC</span> in the header to unlock Fulfillment tools.
          </p>
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-3 sm:grid-cols-4">
          {isScoped ? (
            <Link
              href="/roster"
              prefetch={false}
              className={cls("to-btn", "to-btn--secondary", "px-4 py-3", "text-center")}
            >
              Roster
            </Link>
          ) : (
            <DisabledTile label="Roster" reason="Select a PC scope first" />
          )}

          {isScoped ? (
            <Link
              href="/route-lock"
              prefetch={false}
              className={cls("to-btn", "to-btn--secondary", "px-4 py-3", "text-center")}
            >
              Route Lock
            </Link>
          ) : (
            <DisabledTile label="Route Lock" reason="Select a PC scope first" />
          )}

          {isScoped ? (
            <Link
              href="/metrics"
              prefetch={false}
              className={cls("to-btn", "to-btn--secondary", "px-4 py-3", "text-center")}
            >
              Metrics
            </Link>
          ) : (
            <DisabledTile label="Metrics" reason="Select a PC scope first" />
          )}

          {isScoped ? (
            dcLoading ? (
              <DisabledTile label="Dispatch Console" reason="Checking supervisor access…" />
            ) : dcAllowed ? (
              <Link
                href="/dispatch-console"
                prefetch={false}
                className={cls("to-btn", "to-btn--secondary", "px-4 py-3", "text-center")}
              >
                Dispatch Console
              </Link>
            ) : (
              <DisabledTile label="Dispatch Console" reason="Supervisor+ only (ITG or BP)" />
            )
          ) : (
            <DisabledTile label="Dispatch Console" reason="Select a PC scope first" />
          )}
        </div>
      </Card>

      <Card>
        <p className="text-sm text-[var(--to-ink-muted)]">
          Fulfillment floor landing. Choose a module to continue once PC scope is selected.
        </p>
      </Card>
    </PageShell>
  );
}