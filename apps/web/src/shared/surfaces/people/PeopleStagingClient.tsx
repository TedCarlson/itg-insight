// path: apps/web/src/shared/surfaces/people/PeopleStagingClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  PeopleEditorDrawer,
  type PeopleEditorRow,
} from "./PeopleEditorDrawer";
import {
  PeopleIntakeDrawer,
  type PeopleIntakeCreatedPerson,
} from "./PeopleIntakeDrawer";

type AffiliationOption = {
  affiliation_id: string;
  affiliation_label: string;
};

type Props = {
  affiliations?: AffiliationOption[];
};

type PeopleStagingRow = {
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
  prospecting_affiliation_id: string | null;
  onboarding_pc_org_id: string | null;
  onboarding_pc_org_name: string | null;
  affiliation_code: string | null;
  affiliation: string | null;
  active_assignment_count: number;
  active_orgs: string | null;
};

function readinessLabel(row: PeopleStagingRow) {
  if (row.status !== "active") return "Not Eligible";
  if (!row.tech_id) return "Needs Tech ID";
  return "Workforce Ready";
}

function assignmentLabel(row: PeopleStagingRow) {
  if (row.active_assignment_count > 0) {
    return `Active in: ${row.active_orgs ?? row.active_assignment_count}`;
  }
  return "No active assignment";
}

function statusLabel(status: string | null) {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  if (status === "onboarding") return "Onboarding";
  if (status === "onboarding_closed") return "Onboarding Closed";
  return "Unknown";
}

function statusTone(status: string | null) {
  if (status === "active") {
    return "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]";
  }
  if (status === "onboarding") {
    return "border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_10%,white)]";
  }
  if (status === "onboarding_closed") {
    return "bg-muted text-muted-foreground";
  }
  if (status === "inactive") {
    return "border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_8%,white)]";
  }
  return "bg-muted text-muted-foreground";
}

function toEditorRow(person: PeopleIntakeCreatedPerson): PeopleEditorRow {
  return {
    person_id: person.person_id,
    full_name: person.full_name,
    legal_name: null,
    preferred_name: null,
    status: "onboarding",
    tech_id: person.tech_id,
    fuse_emp_id: null,
    mobile: person.mobile,
    email: person.email,
    nt_login: person.nt_login,
    csg: person.csg,
    prospecting_affiliation_id: person.prospecting_affiliation_id,
    onboarding_pc_org_id: person.onboarding_pc_org_id,
    onboarding_pc_org_name: person.onboarding_pc_org_name,
    affiliation_code: null,
    affiliation: null,
    active_assignment_count: 0,
    active_orgs: null,
  };
}

export function PeopleStagingClient({ affiliations = [] }: Props) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PeopleStagingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPerson, setSelectedPerson] =
    useState<PeopleEditorRow | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const filteredRows = useMemo(() => rows, [rows]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("q", query);
      params.set("limit", "50");

      const res = await fetch(
        `/api/people/staging-search?${params.toString()}`
      );
      const json = await res.json().catch(() => null);

      if (cancelled) return;

      if (!res.ok) {
        setRows([]);
        setError(json?.error ?? "Unable to load people.");
        setLoading(false);
        return;
      }

      setRows(json?.rows ?? []);
      setLoading(false);
    }

    const timer = window.setTimeout(load, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, reloadKey]);

  function handleCreated(person: PeopleIntakeCreatedPerson) {
    setIntakeOpen(false);
    setSelectedPerson(toEditorRow(person));
    setReloadKey((key) => key + 1);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              People
            </div>
            <h1 className="mt-1 text-xl font-semibold">People Staging</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stage and repair identity records before they become workforce-ready.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone, NT login, CSG…"
              className="h-10 w-full rounded-xl border px-3 text-sm lg:w-80"
            />

            <button
              type="button"
              onClick={() => setIntakeOpen(true)}
              className="h-10 whitespace-nowrap rounded-xl border border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] px-4 text-sm font-medium"
            >
              + Add Person
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-[var(--to-danger)] bg-[color-mix(in_oklab,var(--to-danger)_8%,white)] p-3 text-xs">
            {error}
          </div>
        ) : null}

        <div className="mt-3 text-xs text-muted-foreground">
          {loading ? "Loading…" : `${filteredRows.length} people`}
        </div>
      </Card>

      <Card className="p-4">
        {filteredRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No people found.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b text-[11px]">
                  <th className="px-4 py-3 text-left">Person</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">Contact</th>
                  <th className="px-3 py-3 text-left">Identifiers</th>
                  <th className="px-3 py-3 text-left">Prospecting Affiliation</th>
                  <th className="px-3 py-3 text-left">Onboarding Org</th>
                  <th className="px-3 py-3 text-left">Assignment</th>
                  <th className="px-3 py-3 text-left">Readiness</th>
                  <th className="px-3 py-3 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.person_id} className="border-b">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {row.full_name ?? "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.person_id}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[11px]",
                          statusTone(row.status),
                        ].join(" ")}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-sm">
                      <div>{row.mobile ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.email ?? "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm">
                      <div>Tech: {row.tech_id ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        FUSE: {row.fuse_emp_id ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        NT: {row.nt_login ?? "—"} • CSG: {row.csg ?? "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm">
                      <div>{row.affiliation ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.affiliation_code ?? "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <div>{row.onboarding_pc_org_name ?? "—"}</div>
                      {row.status === "onboarding" && !row.onboarding_pc_org_id ? (
                        <div className="text-xs text-[var(--to-danger)]">
                          Needs onboarding org
                        </div>
                      ) : null}
                    </td>

                    <td className="px-3 py-3 text-sm">
                      {assignmentLabel(row)}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[11px]",
                          row.status === "active" && row.tech_id
                            ? "border-[var(--to-success)] bg-[color-mix(in_oklab,var(--to-success)_10%,white)]"
                            : "border-[var(--to-warning)] bg-[color-mix(in_oklab,var(--to-warning)_10%,white)]",
                        ].join(" ")}
                      >
                        {readinessLabel(row)}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedPerson(row)}
                        className="rounded-lg border px-3 py-1.5 text-xs"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PeopleIntakeDrawer
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onCreated={handleCreated}
        affiliations={affiliations}
      />

      <PeopleEditorDrawer
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
        onSaved={() => {
          setSelectedPerson(null);
          setReloadKey((key) => key + 1);
        }}
        affiliations={affiliations}
      />
    </div>
  );
}