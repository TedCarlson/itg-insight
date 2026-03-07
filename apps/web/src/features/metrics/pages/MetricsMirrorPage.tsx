import { redirect } from "next/navigation";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";

import MetricsMirrorClient from "@/features/metrics/components/mirror/MetricsMirrorClient";

type AssignmentRow = {
  person_id: string | null;
  tech_id: string | null;
  position_title: string | null;
  active: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

type PersonRow = {
  person_id: string;
  full_name: string | null;
  emails: string | null;
  active: boolean | null;
};

type MirrorRow = {
  person_id: string;
  full_name: string;
  tech_id: string | null;
  email: string | null;
  position_title: string | null;
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isActiveWindow(row: AssignmentRow, today: string) {
  const activeOk = row?.active === true || row?.active == null;
  const startOk = !row?.start_date || String(row.start_date) <= today;
  const endOk = !row?.end_date || String(row.end_date) >= today;
  return activeOk && startOk && endOk;
}

function pickBestAssignment(rows: AssignmentRow[], today: string): AssignmentRow | null {
  if (!rows.length) return null;

  const current = rows.filter((r) => isActiveWindow(r, today) && r?.tech_id);
  const pool = current.length ? current : rows.filter((r) => r?.tech_id);

  if (!pool.length) return null;

  pool.sort((a, b) =>
    String(b?.start_date ?? "").localeCompare(String(a?.start_date ?? ""))
  );

  return pool[0] ?? null;
}

export default async function MetricsMirrorPage() {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) redirect("/");

  const pc_org_id = scope.selected_pc_org_id;
  const admin = supabaseAdmin();
  const today = isoToday();

  const { data: assignments, error: asgErr } = await admin
    .from("assignment")
    .select("person_id,tech_id,position_title,active,start_date,end_date")
    .eq("pc_org_id", pc_org_id)
    .limit(5000);

  if (asgErr) {
    return (
      <PageShell>
        <Card className="rounded-2xl border p-6">
          <div className="text-base font-semibold">Metrics Mirror</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Failed to load roster for the selected org.
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{asgErr.message}</div>
        </Card>
      </PageShell>
    );
  }

  const byPerson = new Map<string, AssignmentRow[]>();
  for (const row of (assignments ?? []) as AssignmentRow[]) {
    if (!row?.person_id) continue;
    const key = String(row.person_id);
    const arr = byPerson.get(key) ?? [];
    arr.push(row);
    byPerson.set(key, arr);
  }

  const personIds = Array.from(byPerson.keys());

  const { data: persons, error: personErr } = await admin
    .from("person")
    .select("person_id,full_name,emails,active")
    .in("person_id", personIds);

  if (personErr) {
    return (
      <PageShell>
        <Card className="rounded-2xl border p-6">
          <div className="text-base font-semibold">Metrics Mirror</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Failed to load people for the selected org.
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{personErr.message}</div>
        </Card>
      </PageShell>
    );
  }

  const personById = new Map<string, PersonRow>();
  for (const p of (persons ?? []) as PersonRow[]) {
    personById.set(String(p.person_id), p);
  }

  const rows: MirrorRow[] = personIds
    .map((person_id) => {
      const best = pickBestAssignment(byPerson.get(person_id) ?? [], today);
      const person = personById.get(person_id);

      if (!best || !person) return null;
      if (!best.tech_id) return null;

      return {
        person_id,
        full_name: String(person.full_name ?? "Unknown"),
        tech_id: String(best.tech_id),
        email: person.emails ? String(person.emails) : null,
        position_title: best.position_title ? String(best.position_title) : null,
      };
    })
    .filter(Boolean) as MirrorRow[];

  rows.sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <PageShell>
      <div className="space-y-4">
        <Card className="rounded-2xl border p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight">Metrics Mirror</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Leadership entry point into the technician scorecard experience.
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Selected org roster • {rows.length} techs
            </div>
          </div>
        </Card>

        <MetricsMirrorClient rows={rows} />
      </div>
    </PageShell>
  );
}