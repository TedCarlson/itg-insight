"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useOrg } from "@/state/org";
import type { HomePayload } from "../lib/getHomePayload.server";

type NormalizedOrg = {
  key: string;
  id: string | null;
  text: string;
};

function orgLabel(o: any): string {
  const name =
    o?.org_name ??
    o?.name ??
    o?.pc_org_name ??
    o?.display_name ??
    o?.org_slug ??
    o?.slug ??
    null;

  const role = o?.role_label ?? o?.role ?? null;
  const base = name ?? "(unnamed org)";

  return role ? `${base} — ${role}` : base;
}

function orgId(o: any): string | null {
  const raw = o?.pc_org_id ?? o?.id ?? o?.org_id ?? null;
  if (raw === null || raw === undefined) return null;

  const s = String(raw).trim();
  return s.length ? s : null;
}

function Card(props: {
  label: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={props.href}
      className="block rounded-2xl border bg-card p-4 transition hover:bg-muted/10"
    >
      <div className="text-sm font-semibold">{props.label}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {props.description}
      </div>
    </Link>
  );
}

function DirectorOrgLauncher(props: {
  payload: HomePayload;
}) {
  const router = useRouter();
  const { orgs, orgsLoading, orgsError, setSelectedOrgId } = useOrg();
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const canSeeDirectorLauncher =
    props.payload.role === "APP_OWNER" || props.payload.role === "ADMIN";

  const normalizedOrgs = useMemo<NormalizedOrg[]>(() => {
    return (orgs ?? []).map((o: any, idx: number) => {
      const id = orgId(o);
      const text = orgLabel(o);
      return {
        id,
        text,
        key: id ? `director-org-${id}` : `director-org-${idx}-${text}`,
      };
    });
  }, [orgs]);

  async function openDirectorSnapshot(pcOrgId: string) {
    setSavingOrgId(pcOrgId);
    setSaveErr(null);

    try {
      setSelectedOrgId(pcOrgId);

      const res = await fetch("/api/profile/select-org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selected_pc_org_id: pcOrgId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to save org selection");
      }

      router.push("/director/executive");
      router.refresh();
    } catch (e: any) {
      setSaveErr(e?.message ?? "Failed to open Director snapshot");
      setSavingOrgId(null);
    }
  }

  if (!canSeeDirectorLauncher) return null;

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Director Snapshot
      </div>

      <div className="text-sm font-semibold">
        Open an org-scoped executive view
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Select a PC org to enter the Executive Suite while preserving the app’s
        single-org guardrails.
      </p>

      {orgsLoading ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Loading organizations…
        </div>
      ) : orgsError ? (
        <div className="mt-3 text-sm text-red-600">
          Organization load error: {orgsError}
        </div>
      ) : normalizedOrgs.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {normalizedOrgs.map((org) => {
            const disabled = !org.id || savingOrgId !== null;
            const isSaving = org.id && savingOrgId === org.id;

            return (
              <button
                key={org.key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (org.id) void openDirectorSnapshot(org.id);
                }}
                className="rounded-2xl border bg-background p-4 text-left transition hover:bg-muted/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="text-sm font-semibold">{org.text}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {isSaving ? "Opening snapshot…" : "Open Director Executive Snapshot"}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">
          No organizations are available for this account.
        </div>
      )}

      {saveErr ? (
        <div className="mt-3 text-xs text-red-600">{saveErr}</div>
      ) : null}
    </section>
  );
}

export default function HomeDestinations(props: {
  payload: HomePayload;
}) {
  return (
    <div className="space-y-4">
      <DirectorOrgLauncher payload={props.payload} />

      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your Workspace
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {props.payload.destinations.map((d) => (
            <Card
              key={d.href}
              label={d.label}
              description={d.description}
              href={d.href}
            />
          ))}
        </div>
      </section>
    </div>
  );
}