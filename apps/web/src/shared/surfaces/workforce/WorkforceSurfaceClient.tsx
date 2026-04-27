// path: apps/web/src/shared/surfaces/workforce/WorkforceSurfaceClient.tsx

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import type {
  WorkforceRow,
  WorkforceSeatType,
  WorkforceTabKey,
} from "@/shared/types/workforce/workforce.types";
import type { WorkforceSurfacePayload } from "@/shared/types/workforce/surfacePayload";
import {
  badgeTone,
  buildChangeSet,
  buildDraft,
  identityLabel,
  isDraftDirty,
  quickCopyText,
  tabLabel,
  type WorkforceDraft,
} from "./workforceSurface.helpers";
import { WorkforceAssignmentHistoryCard } from "./WorkforceAssignmentHistoryCard";
import {
  WorkforceAddPersonDrawer,
  type WorkforcePersonSearchRow,
} from "./WorkforceAddPersonDrawer";
import { WorkforceStagedPersonDrawer } from "./WorkforceStagedPersonDrawer";

type Props = {
  payload: WorkforceSurfacePayload;
  mode?: "manager" | "supervisor" | "admin";
};

export function WorkforceSurfaceClient({ payload }: Props) {
  const router = useRouter();

  const [tab, setTab] = useState<WorkforceTabKey>("FIELD");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WorkforceRow | null>(null);
  const [draft, setDraft] = useState<WorkforceDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [stagedPerson, setStagedPerson] =
    useState<WorkforcePersonSearchRow | null>(null);

  const pcOrgId = payload.rows[0]?.pc_org_id ?? null;

  const filtered = useMemo(() => {
    let rows = payload.rows;

    if (tab !== "ALL") {
      rows =
        tab === "INCOMPLETE"
          ? rows.filter((r) => r.is_incomplete)
          : rows.filter((r) => r.seat_type === tab);
    }

    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.searchable_text.includes(q));

    return rows;
  }, [payload.rows, tab, search]);

  function openRow(row: WorkforceRow) {
    setSelected(row);
    setDraft(buildDraft(row));
    setSaveError(null);
  }

  function closeDrawer() {
    setSelected(null);
    setDraft(null);
    setSaveError(null);
    setSaving(false);
  }

  function createFromStaged(person: WorkforcePersonSearchRow) {
    setStagedPerson(null);
    setSaveError(null);

    const stagedRow: WorkforceRow = {
      assignment_id: "NEW",
      person_id: person.person_id,
      affiliation_id: null,
      workspace_id: null,
      pc_org_id: pcOrgId,

      tech_id: person.tech_id,

      full_name: person.full_name,
      legal_name: null,
      first_name: null,
      preferred_name: null,
      last_name: null,
      display_name: person.full_name ?? "Unknown Person",

      office_id: null,
      office: null,

      reports_to_assignment_id: null,
      reports_to_person_id: null,
      reports_to_name: null,

      schedule: [],

      seat_type: "FIELD",

      mobile: null,
      email: null,
      nt_login: null,
      csg: null,

      position_title: person.position_title ?? "Technician",
      affiliation: null,
      

      start_date: null,
      end_date: null,

      assignment_status: "active",
      person_status: null,
      is_primary: true,

      is_active: true,
      is_travel_tech: false,
      is_incomplete: true,

      searchable_text: "",
    };

    setSelected(stagedRow);
    setDraft({
      position_title: person.position_title ?? "Technician",
      affiliation_id: null,
      office_id: null,
      reports_to_assignment_id: null,
      seat_type: "FIELD",
      start_date: null,
    });
  }

  async function commitDraft() {
    if (!selected || !draft || !isDraftDirty(selected, draft)) return;

    setSaving(true);
    setSaveError(null);

    const response = await fetch("/api/workforce/assignment/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assignment_id: selected.assignment_id,
        changes: buildChangeSet(selected, draft),
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setSaving(false);
      setSaveError(result?.error ?? "Unable to save workforce update.");
      return;
    }

    closeDrawer();
    router.refresh();
  }

  const dirty = isDraftDirty(selected, draft);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {payload.tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={[
                  "rounded-xl border px-3 py-2 text-sm",
                  tab === t.key
                    ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)]"
                    : "bg-card",
                ].join(" ")}
              >
                {tabLabel(t.key)} ({t.count})
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workforce…"
              className="h-10 w-full rounded-xl border px-3 text-sm lg:w-72"
            />

            <button
              type="button"
              onClick={() => setAddDrawerOpen(true)}
              className="h-10 rounded-xl border border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] px-3 text-sm"
            >
              Add Person
            </button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
          <div>{tabLabel(tab)}</div>
          <div>{filtered.length} rows</div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No records.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b text-[11px]">
                  <th className="px-4 py-3 text-left">Identity</th>
                  <th className="px-3 py-3 text-left">Office</th>
                  <th className="px-3 py-3 text-left">Reports To</th>
                  <th className="px-3 py-3 text-left">Seat</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.assignment_id}
                    onClick={() => openRow(row)}
                    className="cursor-pointer border-b hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{identityLabel(row)}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.position_title ?? "Unknown"}
                      </div>
                    </td>

                    <td className="px-3 py-3">{row.office ?? "—"}</td>

                    <td className="px-3 py-3">
                      {row.reports_to_name ?? (
                        <span className="text-[var(--to-warning)]">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-[11px]",
                          badgeTone(row.seat_type),
                        ].join(" ")}
                      >
                        {tabLabel(row.seat_type)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && draft ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Workforce Detail
                </div>
                <h2 className="mt-1 text-lg font-semibold">
                  {identityLabel(selected)}
                </h2>
                <div className="mt-1 text-sm text-muted-foreground">
                  {selected.position_title ?? "Unknown Position"}
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={`/company-manager/people/${selected.person_id}`}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  Person Record
                </a>

                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Quick Copy</div>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(quickCopyText(selected))
                  }
                  className="rounded-lg border px-3 py-1.5 text-xs"
                >
                  Copy
                </button>
              </div>

              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs leading-5">
                {quickCopyText(selected)}
              </pre>
            </div>

            <div className="mt-4 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Draft Edit State</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Local draft. Saves only when committed.
                  </div>
                </div>

                {dirty ? (
                  <span className="rounded-full border border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_10%,white)] px-2 py-1 text-[11px]">
                    Unsaved draft
                  </span>
                ) : (
                  <span className="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
                    No changes
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm">
                  Seat
                  <select
                    value={draft.seat_type}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        seat_type: e.target.value as WorkforceSeatType,
                      })
                    }
                    className="h-10 rounded-xl border px-3"
                  >
                    <option value="FIELD">Field</option>
                    <option value="LEADERSHIP">Leadership</option>
                    <option value="SUPPORT">Support</option>
                    <option value="TRAVEL">Travel Tech</option>
                    {selected.assignment_id !== "NEW" ? (
                      <option value="FMLA">FMLA</option>
                    ) : null}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  Position
                  <select
                    value={draft.position_title ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        position_title: e.target.value || null,
                      })
                    }
                    className="h-10 rounded-xl border px-3"
                  >
                    <option value="">Select position…</option>
                    {(payload.editOptions?.positions ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  Affiliation
                  <select
                    value={draft.affiliation_id ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        affiliation_id: e.target.value || null,
                      })
                    }
                    className="h-10 rounded-xl border px-3"
                  >
                    <option value="">Select affiliation…</option>
                    {(payload.editOptions?.affiliations ?? []).map((option) => (
                      <option key={option.affiliation_id} value={option.affiliation_id}>
                        {option.affiliation_label}
                        {option.affiliation_code ? ` • ${option.affiliation_code}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  Office
                  <select
                    value={draft.office_id ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        office_id: e.target.value || null,
                      })
                    }
                    className="h-10 rounded-xl border px-3"
                  >
                    <option value="">Select office…</option>
                    {(payload.editOptions?.offices ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  Reports To
                  <select
                    value={draft.reports_to_assignment_id ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        reports_to_assignment_id: e.target.value || null,
                      })
                    }
                    className="h-10 rounded-xl border px-3"
                  >
                    <option value="">Select leader…</option>
                    {(payload.editOptions?.reportsTo ?? []).map((option) => (
                      <option
                        key={option.assignment_id}
                        value={option.assignment_id}
                      >
                        {option.label}
                        {option.position_title
                          ? ` • ${option.position_title}`
                          : ""}
                        {option.affiliation ? ` • ${option.affiliation}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {saveError ? (
                <div className="mt-3 rounded-xl border border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_8%,white)] p-3 text-xs">
                  {saveError}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(buildDraft(selected))}
                  className="rounded-xl border px-3 py-2 text-sm"
                  disabled={saving}
                >
                  Clear Draft
                </button>

                <button
                  type="button"
                  disabled={!dirty || saving}
                  onClick={commitDraft}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm",
                    dirty && !saving
                      ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_12%,white)]"
                      : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {saving ? "Saving…" : "Commit Draft"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border p-4">
              <div className="text-sm font-semibold">Stored Workforce Facts</div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Office</dt>
                  <dd>{selected.office ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reports To</dt>
                  <dd>{selected.reports_to_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Seat</dt>
                  <dd>{selected.seat_type}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{selected.assignment_status ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Start</dt>
                  <dd>{selected.start_date ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">End</dt>
                  <dd>{selected.end_date ?? "Active"}</dd>
                </div>
              </dl>
            </div>

            {selected.assignment_id !== "NEW" ? (
              <WorkforceAssignmentHistoryCard
                assignmentId={selected.assignment_id}
                editOptions={payload.editOptions}
              />
            ) : null}
          </aside>
        </div>
      ) : null}

      <WorkforceAddPersonDrawer
        pcOrgId={pcOrgId}
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
        onStageAdd={(row) => {
          setAddDrawerOpen(false);
          setStagedPerson(row);
        }}
      />

      <WorkforceStagedPersonDrawer
        person={stagedPerson}
        onClose={() => setStagedPerson(null)}
        onCreate={createFromStaged}
      />
    </div>
  );
}