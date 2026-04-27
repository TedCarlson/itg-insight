// path: apps/web/src/shared/surfaces/people/PeopleEditorDrawer.tsx

"use client";

import { useState } from "react";

export type PeopleEditorRow = {
  person_id: string;
  full_name: string | null;
  legal_name: string | null;
  preferred_name: string | null;
  status: string;
  tech_id: string | null;
  fuse_emp_id: string | null;
  mobile: string | null;
  email: string | null;
  nt_login: string | null;
  csg: string | null;
  active_assignment_count: number;
  active_orgs: string | null;
};

type Props = {
  person: PeopleEditorRow | null;
  onClose: () => void;
  onSaved: () => void;
};

type InnerProps = {
  person: PeopleEditorRow;
  onClose: () => void;
  onSaved: () => void;
};

function clean(value: string) {
  const next = value.trim();
  return next ? next : null;
}

export function PeopleEditorDrawer({ person, onClose, onSaved }: Props) {
  if (!person) return null;

  return (
    <PeopleEditorDrawerInner
      key={person.person_id}
      person={person}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function PeopleEditorDrawerInner({ person: p, onClose, onSaved }: InnerProps) {
  const [draft, setDraft] = useState(() => ({
    full_name: p.full_name ?? "",
    legal_name: p.legal_name ?? "",
    preferred_name: p.preferred_name ?? "",
    status: p.status ?? "active",
    tech_id: p.tech_id ?? "",
    fuse_emp_id: p.fuse_emp_id ?? "",
    mobile: p.mobile ?? "",
    email: p.email ?? "",
    nt_login: p.nt_login ?? "",
    csg: p.csg ?? "",
  }));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/people/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        person_id: p.person_id,
        full_name: clean(draft.full_name),
        legal_name: clean(draft.legal_name),
        preferred_name: clean(draft.preferred_name),
        status: draft.status,
        tech_id: clean(draft.tech_id),
        fuse_emp_id: clean(draft.fuse_emp_id),
        mobile: clean(draft.mobile),
        email: clean(draft.email),
        nt_login: clean(draft.nt_login),
        csg: clean(draft.csg),
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setSaving(false);
      setError(json?.error ?? "Unable to save person.");
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              People
            </div>
            <h2 className="mt-1 text-lg font-semibold">Person Editor</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              Identity and onboarding data only. Workforce assignment is handled separately.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            Close
          </button>
        </div>

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
              Legal Name
              <input
                value={draft.legal_name}
                onChange={(e) =>
                  setDraft({ ...draft, legal_name: e.target.value })
                }
                className="h-10 rounded-xl border px-3"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Preferred Name
              <input
                value={draft.preferred_name}
                onChange={(e) =>
                  setDraft({ ...draft, preferred_name: e.target.value })
                }
                className="h-10 rounded-xl border px-3"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Status
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft({ ...draft, status: e.target.value })
                }
                className="h-10 rounded-xl border px-3"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="onboarding">Onboarding</option>
                <option value="onboarding_closed">Onboarding Closed</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border p-4">
          <div className="text-sm font-semibold">Unique Identifiers</div>

          <div className="mt-4 grid gap-3">
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
              FUSE Employee ID
              <input
                value={draft.fuse_emp_id}
                onChange={(e) =>
                  setDraft({ ...draft, fuse_emp_id: e.target.value })
                }
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

        <div className="mt-4 rounded-2xl border p-4">
          <div className="text-sm font-semibold">Contact</div>

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
                onChange={(e) =>
                  setDraft({ ...draft, email: e.target.value })
                }
                className="h-10 rounded-xl border px-3"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border p-4">
          <div className="text-sm font-semibold">Assignment Snapshot</div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Active Assignments</dt>
              <dd>{p.active_assignment_count}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Active Orgs</dt>
              <dd>{p.active_orgs ?? "—"}</dd>
            </div>
          </dl>
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
            disabled={saving}
            className="rounded-xl border border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] px-3 py-2 text-sm"
          >
            {saving ? "Saving…" : "Save Person"}
          </button>
        </div>
      </aside>
    </div>
  );
}