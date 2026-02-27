// RUN THIS
// Replace the entire file:
// apps/web/src/features/metrics/pages/MetricsPage.tsx

import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell, PageHeader } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function SectionCard({ title, href }: { title: string; href: string }) {
  return (
    <Card>
      <Link
        href={href}
        prefetch={false}
        className={cls("to-btn", "to-btn--secondary", "px-4", "py-3", "w-full", "text-center")}
      >
        {title}
      </Link>
    </Card>
  );
}

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(sp: SearchParams | undefined, key: string): string | null {
  const v = sp?.[key];
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type ClassType = "P4P" | "SMART" | "TECH";
type ViewMode = "ALL" | "OUTLIERS";
type Lens = "ORG" | "COMPANY" | "REGION" | "DIVISION" | "SUP_ITG" | "SUP_BP";

function asClassType(v: string | null): ClassType {
  const s = (v ?? "").toUpperCase().trim();
  if (s === "SMART") return "SMART";
  if (s === "TECH") return "TECH";
  return "P4P";
}

function asViewMode(v: string | null): ViewMode {
  const s = (v ?? "").toUpperCase().trim();
  if (s === "OUTLIERS") return "OUTLIERS";
  return "ALL";
}

function asLens(v: string | null): Lens {
  const s = (v ?? "").toUpperCase().trim();
  if (s === "COMPANY") return "COMPANY";
  if (s === "REGION") return "REGION";
  if (s === "DIVISION") return "DIVISION";
  if (s === "SUP_ITG") return "SUP_ITG";
  if (s === "SUP_BP") return "SUP_BP";
  return "ORG";
}

function buildHref(base: string, sp: SearchParams | undefined, patch: Record<string, string>) {
  const u = new URL(base, "http://local");
  // carry over existing query
  if (sp) {
    for (const [k, v] of Object.entries(sp)) {
      const val = Array.isArray(v) ? v[0] : v;
      if (val) u.searchParams.set(k, val);
    }
  }
  // apply patch
  for (const [k, v] of Object.entries(patch)) u.searchParams.set(k, v);
  return u.pathname + (u.search ? u.search : "");
}

function PillLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cls(
        "px-3 py-1.5 text-xs font-medium rounded-full border",
        "transition-colors",
        active
          ? "border-[var(--to-border)] bg-[var(--to-surface-2)] text-[var(--to-ink)]"
          : "border-[var(--to-border)] bg-[var(--to-surface)] text-[var(--to-ink-muted)] hover:text-[var(--to-ink)] hover:bg-[var(--to-surface-2)]"
      )}
    >
      {children}
    </Link>
  );
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function fmtScore(v: unknown) {
  const n = num(v);
  if (n == null) return "—";
  return n.toFixed(2);
}

function fmtPct(v: unknown) {
  const n = num(v);
  if (n == null) return "—";
  const pct = Math.max(0, Math.min(1, n)) * 100;
  return `${pct.toFixed(1)}%`;
}

type Row = {
  batch_id: string;
  pc_org_id: string;
  pc_org_name: string | null;
  metric_date: string;
  fiscal_end_date: string;
  class_type: string;

  person_id: string;
  tech_id: string;
  composite_score_v2: number | null;

  is_outlier: boolean | null;
  status_badge: string | null;

  // ranks
  rank_org: number | null;
  n_org: number | null;
  percentile_org: number | null;

  rank_company: number | null;
  n_company: number | null;
  percentile_company: number | null;

  rank_region: number | null;
  n_region: number | null;
  percentile_region: number | null;

  rank_division: number | null;
  n_division: number | null;
  percentile_division: number | null;

  rank_supervisor_itg: number | null;
  n_supervisor_itg: number | null;
  percentile_supervisor_itg: number | null;

  rank_supervisor_bp: number | null;
  n_supervisor_bp: number | null;
  percentile_supervisor_bp: number | null;

  // convenience
  sort_rank?: number | null;
  sort_score?: number | null;

  region_name?: string | null;
  division_name?: string | null;
};

function pickRank(row: Row, lens: Lens): { rank: number | null; n: number | null; pct: number | null; label: string } {
  switch (lens) {
    case "COMPANY":
      return { rank: row.rank_company ?? null, n: row.n_company ?? null, pct: row.percentile_company ?? null, label: "Company" };
    case "REGION":
      return { rank: row.rank_region ?? null, n: row.n_region ?? null, pct: row.percentile_region ?? null, label: "Region" };
    case "DIVISION":
      return { rank: row.rank_division ?? null, n: row.n_division ?? null, pct: row.percentile_division ?? null, label: "Division" };
    case "SUP_ITG":
      return { rank: row.rank_supervisor_itg ?? null, n: row.n_supervisor_itg ?? null, pct: row.percentile_supervisor_itg ?? null, label: "Sup ITG" };
    case "SUP_BP":
      return { rank: row.rank_supervisor_bp ?? null, n: row.n_supervisor_bp ?? null, pct: row.percentile_supervisor_bp ?? null, label: "Sup BP" };
    case "ORG":
    default:
      return { rank: row.rank_org ?? null, n: row.n_org ?? null, pct: row.percentile_org ?? null, label: "Org" };
  }
}

function cmp(a: number | null, b: number | null) {
  // nulls last
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

export default async function MetricsHomePage({ searchParams }: { searchParams?: SearchParams }) {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) redirect("/home");

  const pc_org_id = scope.selected_pc_org_id;

  const classType = asClassType(getParam(searchParams, "class"));
  const viewMode = asViewMode(getParam(searchParams, "view"));
  const lens = asLens(getParam(searchParams, "lens"));

  const sb = await supabaseServer();

  // Pull a reasonable slice; we sort in JS so lens changes don't require DB gymnastics.
  const { data, error } = await sb
    .from("ui_master_metric_v2_v")
    .select(
      [
        "batch_id",
        "pc_org_id",
        "pc_org_name",
        "metric_date",
        "fiscal_end_date",
        "class_type",
        "person_id",
        "tech_id",
        "composite_score_v2",
        "is_outlier",
        "status_badge",
        "rank_org",
        "n_org",
        "percentile_org",
        "rank_company",
        "n_company",
        "percentile_company",
        "rank_region",
        "n_region",
        "percentile_region",
        "rank_division",
        "n_division",
        "percentile_division",
        "rank_supervisor_itg",
        "n_supervisor_itg",
        "percentile_supervisor_itg",
        "rank_supervisor_bp",
        "n_supervisor_bp",
        "percentile_supervisor_bp",
        "region_name",
        "division_name",
      ].join(",")
    )
    .eq("pc_org_id", pc_org_id)
    .eq("class_type", classType)
    .limit(500);

  const rowsRaw = (data ?? []) as unknown as Row[];

  const rowsFiltered = (viewMode === "OUTLIERS" ? rowsRaw.filter((r) => r.is_outlier) : rowsRaw).slice();

  // Canonical, stable sort for this page: chosen lens rank asc, then score desc, then person_id asc.
  rowsFiltered.sort((a, b) => {
    const ra = pickRank(a, lens).rank;
    const rb = pickRank(b, lens).rank;
    const byRank = cmp(ra, rb);
    if (byRank !== 0) return byRank;

    const sa = num(a.composite_score_v2);
    const sbv = num(b.composite_score_v2);
    if (sa == null && sbv == null) return (a.person_id ?? "").localeCompare(b.person_id ?? "");
    if (sa == null) return 1;
    if (sbv == null) return -1;
    if (sbv !== sa) return sbv - sa;

    return (a.person_id ?? "").localeCompare(b.person_id ?? "");
  });

  const rows = rowsFiltered.slice(0, 50);

  const base = "/metrics";

  return (
    <PageShell>
      <PageHeader title="Metrics" subtitle="Uploads + reporting surfaces (Tech → rollups)." />

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Uploads" href="/metrics/uploads" />
        <SectionCard title="Tech Scorecard" href="/metrics/reports" />
      </div>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">Reports</div>
            <div className="text-xs text-[var(--to-ink-muted)]">
              Rendered on this page (v2 frame). Stable ranks persist across filters.
            </div>
          </div>

          {/* Controls (pills, not buttons) */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[11px] font-medium text-[var(--to-ink-muted)]">Class</div>
              <PillLink href={buildHref(base, searchParams, { class: "P4P" })} active={classType === "P4P"}>
                P4P
              </PillLink>
              <PillLink href={buildHref(base, searchParams, { class: "SMART" })} active={classType === "SMART"}>
                SMART
              </PillLink>
              <PillLink href={buildHref(base, searchParams, { class: "TECH" })} active={classType === "TECH"}>
                TECH
              </PillLink>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[11px] font-medium text-[var(--to-ink-muted)]">View</div>
              <PillLink href={buildHref(base, searchParams, { view: "ALL" })} active={viewMode === "ALL"}>
                All
              </PillLink>
              <PillLink href={buildHref(base, searchParams, { view: "OUTLIERS" })} active={viewMode === "OUTLIERS"}>
                Outliers
              </PillLink>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[11px] font-medium text-[var(--to-ink-muted)]">Lens</div>
              <PillLink href={buildHref(base, searchParams, { lens: "ORG" })} active={lens === "ORG"}>
                Org
              </PillLink>
              <PillLink href={buildHref(base, searchParams, { lens: "COMPANY" })} active={lens === "COMPANY"}>
                Company
              </PillLink>
              <PillLink href={buildHref(base, searchParams, { lens: "REGION" })} active={lens === "REGION"}>
                Region
              </PillLink>
              <PillLink href={buildHref(base, searchParams, { lens: "DIVISION" })} active={lens === "DIVISION"}>
                Division
              </PillLink>
              <PillLink href={buildHref(base, searchParams, { lens: "SUP_ITG" })} active={lens === "SUP_ITG"}>
                Sup ITG
              </PillLink>
              <PillLink href={buildHref(base, searchParams, { lens: "SUP_BP" })} active={lens === "SUP_BP"}>
                Sup BP
              </PillLink>
            </div>
          </div>

          {/* Data */}
          <div className="rounded-xl border border-[var(--to-border)] overflow-hidden">
            <div className="px-3 py-2 bg-[var(--to-surface-2)] flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-[var(--to-ink-muted)]">
                Org: <span className="font-medium text-[var(--to-ink)]">{pc_org_id}</span>
                {" • "}
                Class: <span className="font-medium text-[var(--to-ink)]">{classType}</span>
                {" • "}
                View: <span className="font-medium text-[var(--to-ink)]">{viewMode}</span>
                {" • "}
                Lens: <span className="font-medium text-[var(--to-ink)]">{lens}</span>
              </div>

              <div className="text-xs text-[var(--to-ink-muted)]">
                Rows: <span className="font-medium text-[var(--to-ink)]">{rowsFiltered.length}</span>
                {error ? (
                  <>
                    {" • "}
                    <span className="font-medium text-[var(--to-danger)]">Query error</span>
                  </>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="p-3 text-sm text-[var(--to-danger)]">
                Failed to load v2 report rows.{" "}
                <span className="font-mono text-xs">{String((error as any)?.message ?? error)}</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-3 text-sm text-[var(--to-ink-muted)]">No rows found for this selection.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-[var(--to-ink-muted)]">
                  <tr className="border-t border-[var(--to-border)]">
                    <th className="text-left font-medium px-3 py-2 w-[90px]">Rank</th>
                    <th className="text-left font-medium px-3 py-2 w-[110px]">Score</th>
                    <th className="text-left font-medium px-3 py-2 w-[110px]">Percentile</th>
                    <th className="text-left font-medium px-3 py-2 w-[120px]">Tech ID</th>
                    <th className="text-left font-medium px-3 py-2">Context</th>
                    <th className="text-right font-medium px-3 py-2 w-[110px]">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const rr = pickRank(r, lens);
                    const rankText = rr.rank == null || rr.n == null ? "—" : `${rr.rank} / ${rr.n}`;
                    const pct = fmtPct(rr.pct);
                    const ctxBits = [
                      r.pc_org_name ? `PC: ${r.pc_org_name}` : null,
                      r.division_name ? `Div: ${r.division_name}` : null,
                      r.region_name ? `Reg: ${r.region_name}` : null,
                      r.fiscal_end_date ? `FM End: ${r.fiscal_end_date}` : null,
                    ].filter(Boolean);

                    return (
                      <tr
                        key={`${r.batch_id}-${r.pc_org_id}-${r.class_type}-${r.person_id}-${r.metric_date}-${r.fiscal_end_date}`}
                        className="border-t border-[var(--to-border)]"
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-[var(--to-ink)]">{rankText}</div>
                          <div className="text-[11px] text-[var(--to-ink-muted)]">{rr.label}</div>
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--to-ink)]">{fmtScore(r.composite_score_v2)}</td>
                        <td className="px-3 py-2 text-[var(--to-ink)]">{pct}</td>
                        <td className="px-3 py-2 font-medium text-[var(--to-ink)]">{r.tech_id ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-[var(--to-ink-muted)]">
                          {ctxBits.length ? ctxBits.join(" • ") : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            {r.is_outlier ? (
                              <span className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--to-ink)]">
                                Outlier
                              </span>
                            ) : null}
                            {r.status_badge ? (
                              <span className="rounded-full border border-[var(--to-border)] bg-[var(--to-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--to-ink-muted)]">
                                {r.status_badge}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="text-xs text-[var(--to-ink-muted)]">
            First draft: top 50 rows shown. Next we’ll add the “Metrics / Outliers / All” table mode consistency (same sort rules) and wire KPI columns from computed JSON.
          </div>
        </div>
      </Card>
    </PageShell>
  );
}