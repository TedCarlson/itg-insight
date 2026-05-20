// path: apps/web/src/shared/surfaces/people/PeopleIntakeDrawer.tsx

"use client";

import { useEffect, useState } from "react";

export type PeopleIntakeCreatedPerson = {
  person_id: string;
  full_name: string;
  tech_id: string | null;
  email: string | null;
  mobile: string | null;
  nt_login: string | null;
  csg: string | null;
  prospecting_affiliation_id: string | null;
  onboarding_pc_org_id: string | null;
  onboarding_pc_org_name: string | null;
};

type AffiliationOption = {
  affiliation_id: string;
  affiliation_label: string;
};

type OnboardingOrgOption = {
  pc_org_id: string;
  pc_org_name: string | null;
  fulfillment_center_name: string | null;
  is_selected: boolean;
};

type DuplicateMatch = {
  person_id: string;
  full_name: string | null;
  status: string | null;
  tech_id: string | null;
  mobile: string | null;
  email: string | null;
  nt_login: string | null;
  csg: string | null;
  active_assignment_count: number | null;
  active_orgs: string | null;
  match_reasons: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (person: PeopleIntakeCreatedPerson) => void;
  affiliations?: AffiliationOption[];
};

function clean(value: string) {
  const next = value.trim();
  return next ? next : null;
}

export function PeopleIntakeDrawer({
  open,
  onClose,
  onCreated,
  affiliations = [],
}: Props) {
  const [draft, setDraft] = useState({
    full_name: "",
    tech_id: "",
    prospecting_affiliation_id: "",
    mobile: "",
    email: "",
    nt_login: "",
    csg: "",
    onboarding_pc_org_id: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [orgOptions, setOrgOptions] = useState<OnboardingOrgOption[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadOrgOptions() {
      setOrgLoading(true);

      const res = await fetch("/api/people/onboarding-org-options");
      const json = await res.json().catch(() => null);

      if (cancelled) return;

      const rows = Array.isArray(json?.rows) ? json.rows : [];
      setOrgOptions(rows);

      const selected =
        rows.find((row: OnboardingOrgOption) => row.is_selected) ?? rows[0];

      if (selected?.pc_org_id) {
        setDraft((current) => ({
          ...current,
          onboarding_pc_org_id:
            current.onboarding_pc_org_id || selected.pc_org_id,
        }));
      }

      setOrgLoading(false);
    }

    loadOrgOptions();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const hasSignal =
      draft.full_name.trim().length >= 3 ||
      draft.tech_id.trim().length >= 2 ||
      draft.mobile.trim().length >= 4 ||
      draft.email.trim().length >= 4 ||
      draft.nt_login.trim().length >= 2;

    if (!hasSignal) return;

    let cancelled = false;

    async function checkDuplicates() {
      setDuplicateLoading(true);

      const params = new URLSearchParams();
      if (clean(draft.full_name)) params.set("q", draft.full_name.trim());
      if (clean(draft.tech_id)) params.set("tech_id", draft.tech_id.trim());
      if (clean(draft.mobile)) params.set("mobile", draft.mobile.trim());
      if (clean(draft.email)) params.set("email", draft.email.trim());
      if (clean(draft.nt_login)) params.set("nt_login", draft.nt_login.trim());

      const res = await fetch(
        `/api/people/duplicate-check?${params.toString()}`
      );
      const json = await res.json().catch(() => null);

      if (cancelled) return;

      if (!res.ok) {
        setDuplicateMatches([]);
        setDuplicateLoading(false);
        return;
      }

      setDuplicateMatches(json?.matches ?? []);
      setDuplicateLoading(false);
    }

    const timer = window.setTimeout(checkDuplicates, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    open,
    draft.full_name,
    draft.tech_id,
    draft.mobile,
    draft.email,
    draft.nt_login,
  ]);

  const hasDuplicateSignal =
    draft.full_name.trim().length >= 3 ||
    draft.tech_id.trim().length >= 2 ||
    draft.mobile.trim().length >= 4 ||
    draft.email.trim().length >= 4 ||
    draft.nt_login.trim().length >= 2;

  if (!open) return null;

  async function save() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/people/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: clean(draft.full_name),
        tech_id: clean(draft.tech_id),
        prospecting_affiliation_id: clean(draft.prospecting_affiliation_id),
        mobile: clean(draft.mobile),
        email: clean(draft.email),
        nt_login: clean(draft.nt_login),
        csg: clean(draft.csg),
        onboarding_pc_org_id: clean(draft.onboarding_pc_org_id),
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.person_id) {
      setSaving(false);
      setError(json?.error ?? "Unable to create person.");
      return;
    }

    setSaving(false);

    onCreated({
      person_id: json.person_id,
      full_name: draft.full_name.trim(),
      tech_id: clean(draft.tech_id),
      prospecting_affiliation_id: clean(draft.prospecting_affiliation_id),
      onboarding_pc_org_id: json.onboarding_pc_org_id ?? null,
      onboarding_pc_org_name: json.onboarding_pc_org_name ?? null,
      mobile: clean(draft.mobile),
      email: clean(draft.email),
      nt_login: clean(draft.nt_login),
      csg: clean(draft.csg),
    });

    setDraft({
      full_name: "",
      tech_id: "",
      prospecting_affiliation_id: "",
      mobile: "",
      email: "",
      nt_login: "",
      csg: "",
      onboarding_pc_org_id: "",
    });

    setDuplicateMatches([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              People Intake
            </div>
            <h2 className="mt-1 text-lg font-semibold">Create Person</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              Creates an onboarding person record. Workforce assignment can be
              staged after creation.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            Close
          </button>
        </div>

        {orgOptions.length > 1 ? (
          <div className="mt-5 rounded-2xl border p-4">
            <div className="text-sm font-semibold">Onboarding Org</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Defaults to your selected org. Change only when creating this onboarding record for another org in your scope.
            </div>

            <select
              value={draft.onboarding_pc_org_id}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  onboarding_pc_org_id: event.target.value,
                })
              }
              className="mt-3 h-10 w-full rounded-xl border px-3 text-sm"
            >
              {orgOptions.map((org) => (
                <option key={org.pc_org_id} value={org.pc_org_id}>
                  {org.pc_org_name ?? org.fulfillment_center_name ?? org.pc_org_id}
                </option>
              ))}
            </select>
          </div>
        ) : orgOptions.length === 1 ? (
          <div className="mt-5 rounded-2xl border bg-muted/30 p-4">
            <div className="text-sm font-semibold">Onboarding Org</div>
            <div className="mt-1 text-sm">
              {orgOptions[0]?.pc_org_name ??
                orgOptions[0]?.fulfillment_center_name ??
                "Selected org"}
            </div>
          </div>
        ) : orgLoading ? (
          <div className="mt-5 rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            Loading onboarding org…
          </div>
        ) : null}

        {hasDuplicateSignal && (duplicateMatches.length > 0 || duplicateLoading) ? (
          <div className="mt-5 rounded-2xl border border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_8%,white)] p-4">
            <div className="text-sm font-semibold">Possible Existing Matches</div>
            <div className="mt-1 text-xs text-muted-foreground">
              This is a heads-up only. You can still create the person if this is not a duplicate.
            </div>

            <div className="mt-3 space-y-2">
              {duplicateLoading ? (
                <div className="text-xs text-muted-foreground">
                  Checking for similar records…
                </div>
              ) : null}

              {duplicateMatches.map((match) => (
                <div
                  key={match.person_id}
                  className="rounded-xl border bg-background/70 p-3 text-xs"
                >
                  <div className="font-semibold">
                    {match.full_name ?? "Unknown Person"}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Tech: {match.tech_id ?? "—"} • NT: {match.nt_login ?? "—"} •{" "}
                    Mobile: {match.mobile ?? "—"}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Status: {match.status ?? "—"} • Assignments:{" "}
                    {match.active_assignment_count ?? 0}
                    {match.active_orgs ? ` • ${match.active_orgs}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {match.match_reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border px-2 py-0.5 text-[10px]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border p-4">
          <div className="text-sm font-semibold">Identity</div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              Full Name
              <input
                value={draft.full_name}
                onChange={(e) =>
                  setDraft({ ...draft, full_name: e.target.value })
                }
                className="h-10 rounded-xl border px-3"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Tech ID
              <input
                value={draft.tech_id}
                onChange={(e) =>
                  setDraft({ ...draft, tech_id: e.target.value })
                }
                className="h-10 rounded-xl border px-3"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Prospecting Affiliation
              <select
                value={draft.prospecting_affiliation_id}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    prospecting_affiliation_id: e.target.value,
                  })
                }
                className="h-10 rounded-xl border px-3"
              >
                <option value="">Select affiliation…</option>
                {affiliations.map((option) => (
                  <option
                    key={option.affiliation_id}
                    value={option.affiliation_id}
                  >
                    {option.affiliation_label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border p-4">
          <div className="text-sm font-semibold">Contact / System IDs</div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              Mobile
              <input
                value={draft.mobile}
                onChange={(e) =>
                  setDraft({ ...draft, mobile: e.target.value })
                }
                className="h-10 rounded-xl border px-3"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Email
              <input
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="h-10 rounded-xl border px-3"
              />
            </label>

            <label className="grid gap-1 text-sm">
              NT Login
              <input
                value={draft.nt_login}
                onChange={(e) =>
                  setDraft({ ...draft, nt_login: e.target.value })
                }
                className="h-10 rounded-xl border px-3"
              />
            </label>

            <label className="grid gap-1 text-sm">
              CSG ID
              <input
                value={draft.csg}
                onChange={(e) => setDraft({ ...draft, csg: e.target.value })}
                className="h-10 rounded-xl border px-3"
              />
            </label>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_8%,white)] p-3 text-xs">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={save}
            disabled={saving || !draft.full_name.trim()}
            className="rounded-xl border border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] px-3 py-2 text-sm"
          >
            {saving ? "Creating…" : "Create Person"}
          </button>
        </div>
      </aside>
    </div>
  );
}