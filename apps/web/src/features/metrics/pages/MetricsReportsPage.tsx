import { redirect } from "next/navigation";

import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

import FiscalSelector from "@/features/metrics/components/FiscalSelector";
import ReportsClientShell from "@/features/metrics/components/reports/ReportsClientShell";
import ReportsFilterBar from "@/features/metrics/components/reports/ReportsFilterBar";
import ReportsTabbedTable from "@/features/metrics/components/reports/ReportsTabbedTable";
import ReportSummaryTiles from "@/features/metrics/components/reports/ReportSummaryTiles";

import { numOrInf } from "@/features/metrics/lib/reports/format";
import { resolveRubricKey, buildRubricMap, applyBandsToRows } from "@/features/metrics/lib/reports/rubric";

import { GLOBAL_BAND_PRESETS } from "@/features/metrics-admin/lib/globalBandPresets";
import { P4P_KPIS } from "@/features/metrics/lib/reports/kpis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  fiscal?: string;
  reports_to?: string;
  class?: string; // optional future: P4P/SMART/TECH
};

type SnapshotRow = {
  batch_id: string;
  class_type: string;
  pc_org_id: string;
  metric_date: string;
  fiscal_end_date: string;

  tech_id: string;
  person_id: string;

  ownership_mode: string;
  direct_reports_to_person_id: string | null;
  itg_rollup_person_id: string | null;

  office_id: string | null;
  position_title: string | null;

  co_ref: string | null;
  co_code: string | null;

  composite_score: number | null;
  rank_org: number | null;
  population_size: number | null;
  status_badge: string | null;

  is_totals: boolean;

  raw_metrics_json: any | null;
  computed_metrics_json: any | null;

  created_at: string;
};

function currentFiscalEndDateISO_NY(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  let endYear = year;
  let endMonth = month;

  if (day >= 22) {
    endMonth = month + 1;
    if (endMonth === 13) {
      endMonth = 1;
      endYear = year + 1;
    }
  }

  return `${endYear}-${String(endMonth).padStart(2, "0")}-21`;
}

function metricNum(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== "object") return null;
  const v = (obj as Record<string, unknown>)[key];
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pickStatusBadge(s: { is_totals?: boolean; ownership_mode?: string | null; composite_score?: number | null }) {
  if (s.is_totals) return { status_badge: "TOTALS", status_sort: 999 };
  if (String(s.ownership_mode ?? "") !== "ACTIVE") return { status_badge: "UNLINKED", status_sort: 50 };
  if (s.composite_score == null) return { status_badge: "UNLINKED", status_sort: 50 };
  return { status_badge: "OK", status_sort: 10 };
}

function isRubricRowMeaningful(r: any) {
  return r?.min_value != null || r?.max_value != null || r?.score_value != null;
}

function filterEmptyRubricGroups(rows: any[]) {
  const byKpi = new Map<string, any[]>();
  for (const r of rows) {
    const k = String(r.kpi_key ?? "");
    const arr = byKpi.get(k) ?? [];
    arr.push(r);
    byKpi.set(k, arr);
  }

  const out: any[] = [];
  for (const [, group] of byKpi.entries()) {
    if (!group.some(isRubricRowMeaningful)) continue;
    out.push(...group);
  }
  return out;
}

function toUiRow(r: SnapshotRow) {
  const raw = r.raw_metrics_json ?? {};
  const comp = r.computed_metrics_json ?? {};

  const tnps_score =
    metricNum(comp, "tnps_score") ??
    metricNum(comp, "tNPS Rate") ??
    metricNum(raw, "tnps_score") ??
    metricNum(raw, "tNPS Rate");

  const ftr_rate =
    metricNum(comp, "ftr_rate") ??
    metricNum(comp, "FTR%") ??
    metricNum(raw, "ftr_rate") ??
    metricNum(raw, "FTR%");

  const tool_usage_rate =
    metricNum(comp, "tool_usage_rate") ??
    metricNum(comp, "ToolUsage") ??
    metricNum(raw, "tool_usage_rate") ??
    metricNum(raw, "ToolUsage");

  const total_jobs =
    metricNum(comp, "Total Jobs") ??
    metricNum(raw, "Total Jobs") ??
    metricNum(comp, "total_jobs") ??
    metricNum(raw, "total_jobs");

  const installs = metricNum(comp, "Installs") ?? metricNum(raw, "Installs") ?? metricNum(comp, "installs") ?? metricNum(raw, "installs");
  const sros = metricNum(comp, "SROs") ?? metricNum(raw, "SROs") ?? metricNum(comp, "sros") ?? metricNum(raw, "sros");
  const tcs = metricNum(comp, "TCs") ?? metricNum(raw, "TCs") ?? metricNum(comp, "tcs") ?? metricNum(raw, "tcs");

  const total_ftr_contact_jobs =
    metricNum(raw, "Total FTR/Contact Jobs") ??
    metricNum(comp, "Total FTR/Contact Jobs") ??
    metricNum(raw, "total_ftr_contact_jobs");

  const tnps_surveys = metricNum(raw, "tNPS Surveys") ?? metricNum(comp, "tNPS Surveys") ?? metricNum(raw, "tnps_surveys");
  const tnps_promoters = metricNum(raw, "Promoters") ?? metricNum(comp, "Promoters") ?? metricNum(raw, "tnps_promoters");
  const tnps_detractors = metricNum(raw, "Detractors") ?? metricNum(comp, "Detractors") ?? metricNum(raw, "tnps_detractors");
  const tu_eligible_jobs = metricNum(raw, "TUEligibleJobs") ?? metricNum(comp, "TUEligibleJobs") ?? metricNum(raw, "tu_eligible_jobs");

  const badge = pickStatusBadge({
    is_totals: Boolean(r.is_totals),
    ownership_mode: r.ownership_mode ?? null,
    composite_score: r.composite_score ?? null,
  });

  return {
    tech_id: r.tech_id,
    person_id: r.person_id,
    reports_to_person_id: r.direct_reports_to_person_id,

    itg_rollup_person_id: r.itg_rollup_person_id,

    ownership_mode: r.ownership_mode,
    metric_date: r.metric_date,
    fiscal_end_date: r.fiscal_end_date,

    weighted_score: r.composite_score,
    rank_in_pc: r.rank_org,
    population_size: r.population_size,

    tnps_score,
    ftr_rate,
    tool_usage_rate,

    total_jobs,
    installs,
    sros,
    tcs,

    total_ftr_contact_jobs,
    tnps_surveys,
    tnps_promoters,
    tnps_detractors,
    tu_eligible_jobs,

    status_badge: badge.status_badge,
    status_sort: badge.status_sort,
  };
}

async function getViewerPersonId(sb: any): Promise<string | null> {
  const { data, error } = await sb.from("user_profile").select("person_id").maybeSingle();
  if (error) return null;
  return data?.person_id ? String(data.person_id) : null;
}

async function loadFiscalOptions(sb: any, pc_org_id: string, classType: string): Promise<string[]> {
  const { data, error } = await sb
    .from("master_kpi_archive_snapshot")
    .select("fiscal_end_date")
    .eq("pc_org_id", pc_org_id)
    .eq("class_type", classType)
    .order("fiscal_end_date", { ascending: false });

  if (error) return [];
  const opts: string[] = Array.from(new Set((data ?? []).map((r: any) => String(r.fiscal_end_date))));
  return opts;
}

async function loadLatestBatchMeta(sb: any, pc_org_id: string, classType: string, fiscal_end_date: string) {
  const { data, error } = await sb
    .from("master_kpi_archive_snapshot")
    .select("batch_id, metric_date, created_at")
    .eq("pc_org_id", pc_org_id)
    .eq("class_type", classType)
    .eq("fiscal_end_date", fiscal_end_date)
    .order("metric_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return null;
  const row = data?.[0];
  if (!row?.batch_id) return null;

  return {
    batch_id: String(row.batch_id),
    metric_date: String(row.metric_date),
  };
}

async function loadPriorBatchMetaSameFiscal(sb: any, pc_org_id: string, classType: string, fiscal_end_date: string, before_metric_date: string) {
  const { data, error } = await sb
    .from("master_kpi_archive_snapshot")
    .select("batch_id, metric_date, created_at")
    .eq("pc_org_id", pc_org_id)
    .eq("class_type", classType)
    .eq("fiscal_end_date", fiscal_end_date)
    .lt("metric_date", before_metric_date)
    .order("metric_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return null;
  const row = data?.[0];
  if (!row?.batch_id) return null;

  return {
    batch_id: String(row.batch_id),
    metric_date: String(row.metric_date),
  };
}

async function loadSnapshotRows(
  sb: any,
  pc_org_id: string,
  classType: string,
  fiscal_end_date: string,
  batch_id: string
): Promise<SnapshotRow[]> {
  const { data, error } = await sb
    .from("master_kpi_archive_snapshot")
    .select(
      [
        "batch_id",
        "class_type",
        "pc_org_id",
        "metric_date",
        "fiscal_end_date",
        "tech_id",
        "person_id",
        "ownership_mode",
        "direct_reports_to_person_id",
        "itg_rollup_person_id",
        "office_id",
        "position_title",
        "co_ref",
        "co_code",
        "composite_score",
        "rank_org",
        "population_size",
        "status_badge",
        "is_totals",
        "raw_metrics_json",
        "computed_metrics_json",
        "created_at",
      ].join(",")
    )
    .eq("pc_org_id", pc_org_id)
    .eq("class_type", classType)
    .eq("fiscal_end_date", fiscal_end_date)
    .eq("batch_id", batch_id)
    .eq("is_totals", false);

  if (error) return [];
  return (data ?? []) as any;
}

async function scopeRowsForViewer(sb: any, pc_org_id: string, rows: any[]) {
  // is_owner
  const ownerRes = await sb.rpc("is_owner");
  const isOwner = ownerRes?.error ? false : Boolean(ownerRes?.data);
  if (isOwner) return { scopeLabel: "ORG", rows };

  // perms (non-owner)
  const apiClient: any = (sb as any).schema ? (sb as any).schema("api") : sb;

  const permRes = await apiClient.rpc("has_any_pc_org_permission", {
    p_pc_org_id: pc_org_id,
    p_permission_keys: ["metrics_manage", "roster_manage", "leadership_manage"],
  });

  const allowed = permRes?.error ? false : Boolean(permRes?.data);
  if (allowed) return { scopeLabel: "ORG", rows };

  // fallback: infer role from row linkage
  const viewerPersonId = await getViewerPersonId(sb);
  if (!viewerPersonId) return { scopeLabel: "TECH", rows: [] as any[] };

  const itgHas = rows.some((r) => String(r.itg_rollup_person_id ?? "") === viewerPersonId);
  if (itgHas) {
    return {
      scopeLabel: "ITG_SUPERVISOR",
      rows: rows.filter((r) => String(r.itg_rollup_person_id ?? "") === viewerPersonId),
    };
  }

  const bpHas = rows.some((r) => String(r.reports_to_person_id ?? "") === viewerPersonId);
  if (bpHas) {
    return {
      scopeLabel: "BP_SUPERVISOR",
      rows: rows.filter((r) => String(r.reports_to_person_id ?? "") === viewerPersonId),
    };
  }

  return {
    scopeLabel: "TECH",
    rows: rows.filter((r) => String(r.person_id ?? "") === viewerPersonId),
  };
}

export default async function MetricsReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scopeAuth = await requireSelectedPcOrgServer();
  if (!scopeAuth.ok) redirect("/home");

  const sp = await searchParams;
  const sb = await supabaseServer();
  const admin = supabaseAdmin();
  const pc_org_id = scopeAuth.selected_pc_org_id;

  const classType =
    String(sp.class ?? "P4P").toUpperCase() === "SMART"
      ? "SMART"
      : String(sp.class ?? "P4P").toUpperCase() === "TECH"
        ? "TECH"
        : "P4P";

  const fiscalOptions = await loadFiscalOptions(sb, pc_org_id, classType);

  const currentFiscal = currentFiscalEndDateISO_NY();
  const defaultFiscal = fiscalOptions.includes(currentFiscal) ? currentFiscal : fiscalOptions[0];
  const selectedFiscal = sp.fiscal ?? defaultFiscal ?? currentFiscal;

  const presetKeys = Object.keys(GLOBAL_BAND_PRESETS);
  const { data: sel } = await admin.from("metrics_band_style_selection").select("preset_key").eq("selection_key", "GLOBAL").maybeSingle();
  const activeKey = sel?.preset_key && presetKeys.includes(sel.preset_key) ? sel.preset_key : presetKeys[0] ?? "MODERN";
  const activePreset = GLOBAL_BAND_PRESETS[activeKey] ?? GLOBAL_BAND_PRESETS[presetKeys[0] ?? "MODERN"];

  const { data: rubricRowsRaw } = await admin
    .from("metrics_class_kpi_rubric")
    .select("class_type,kpi_key,band_key,min_value,max_value,score_value")
    .eq("class_type", "TECH");

  const rubricRowsAll = filterEmptyRubricGroups(rubricRowsRaw ?? []);
  const distinctKeys = Array.from(new Set(rubricRowsAll.map((r: any) => String(r.kpi_key))));

  const tnpsKey = resolveRubricKey(distinctKeys, ["tnps", "nps"]) ?? "tnps_score";
  const ftrKey = resolveRubricKey(distinctKeys, ["ftr"]) ?? "ftr_rate";
  const toolKey = resolveRubricKey(distinctKeys, ["tool"]) ?? "tool_usage_rate";

  const rubricMap = buildRubricMap(rubricRowsAll);

  // If no options yet, render safe empty state
  if (!fiscalOptions.length) {
    return (
      <PageShell>
        <ReportsClientShell
          title="Metrics"
          subtitle="Reports • one-click landing (snapshot-driven)"
          preset={activePreset}
          rubricRows={rubricRowsAll as any}
          kpis={P4P_KPIS}
          classType={classType as any}
        />

        <Card>
          <div className="flex items-center gap-4 flex-wrap">
            <FiscalSelector options={[selectedFiscal]} selected={selectedFiscal} />
          </div>
        </Card>

        <Card>
          <div className="text-sm font-medium">No report data yet</div>
          <div className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Wired to <span className="font-mono text-xs">master_kpi_archive_snapshot</span>. When snapshot rows exist, they’ll show here automatically.
          </div>
        </Card>
      </PageShell>
    );
  }

  const batchMeta = await loadLatestBatchMeta(sb, pc_org_id, classType, selectedFiscal);
  if (!batchMeta) {
    return (
      <PageShell>
        <ReportsClientShell
          title="Metrics"
          subtitle="Reports • one-click landing (snapshot-driven)"
          preset={activePreset}
          rubricRows={rubricRowsAll as any}
          kpis={P4P_KPIS}
          classType={classType as any}
        />

        <Card>
          <div className="flex items-center gap-4 flex-wrap">
            <FiscalSelector options={fiscalOptions} selected={selectedFiscal} />
          </div>
        </Card>

        <Card>
          <div className="text-sm font-medium">No reportable batch found for this fiscal</div>
          <div className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Fiscal End: <span className="font-mono text-xs">{selectedFiscal}</span>
          </div>
        </Card>
      </PageShell>
    );
  }

  const latestMetricDate = batchMeta.metric_date;

  const snapshotRowsRaw = await loadSnapshotRows(sb, pc_org_id, classType, selectedFiscal, batchMeta.batch_id);
  const snapshotUiRows = snapshotRowsRaw.map(toUiRow);

  const scoped = await scopeRowsForViewer(sb, pc_org_id, snapshotUiRows);

  const selectedReportsTo = sp.reports_to ?? "ALL";
  const applyReportsTo = (arr: any[]) => {
    if (selectedReportsTo === "ALL") return arr;
    return arr.filter((r: any) => String(r.reports_to_person_id ?? "") === selectedReportsTo);
  };

  let filteredRows = applyReportsTo(scoped.rows);

  filteredRows = filteredRows.sort((a: any, b: any) => {
    if (a.status_sort !== b.status_sort) return a.status_sort - b.status_sort;
    const ar = numOrInf(a.rank_in_pc);
    const br = numOrInf(b.rank_in_pc);
    if (ar !== br) return ar - br;
    return String(a.tech_id).localeCompare(String(b.tech_id));
  });

  const okRows = filteredRows.filter((r: any) => r.status_badge === "OK");
  const nonOkRows = filteredRows.filter((r: any) => r.status_badge !== "OK");

  const priorBatch = await loadPriorBatchMetaSameFiscal(sb, pc_org_id, classType, selectedFiscal, latestMetricDate);
  const priorMetricDate = priorBatch?.metric_date ?? null;

  const priorSnapshotRaw = priorBatch ? await loadSnapshotRows(sb, pc_org_id, classType, selectedFiscal, priorBatch.batch_id) : [];
  const priorUi = priorSnapshotRaw.map(toUiRow);

  const priorScoped = await scopeRowsForViewer(sb, pc_org_id, priorUi);
  const priorRowsScoped = applyReportsTo(priorScoped.rows);

  const priorByTechId = new Map<string, any>();
  priorRowsScoped.forEach((r: any) => {
    priorByTechId.set(String(r.tech_id), {
      tnps_score: r.tnps_score ?? null,
      ftr_rate: r.ftr_rate ?? null,
      tool_usage_rate: r.tool_usage_rate ?? null,
    });
  });

  // ---------- FIX: force arrays to string[] (prevents unknown[] -> string[]) ----------
  const ids = new Set<string>();
  (snapshotUiRows ?? []).forEach((r: any) => {
    if (r.person_id) ids.add(String(r.person_id));
    if (r.reports_to_person_id) ids.add(String(r.reports_to_person_id));
  });

  const personIds: string[] = Array.from(ids); // ✅ typed

  const personNameById = new Map<string, string>();
  const personMetaById = new Map<string, { affiliation_kind: "company" | "contractor" | null; affiliation_name: string | null }>();

  if (personIds.length > 0) {
    const { data: people } = await admin.from("person").select("person_id, full_name, co_ref_id, co_code").in("person_id", personIds);

    (people ?? []).forEach((p: any) => {
      personNameById.set(String(p.person_id), p.full_name ?? "—");
    });

    const coRefIds: string[] = Array.from(
      new Set(
        (people ?? [])
          .map((p: any) => (p.co_ref_id ? String(p.co_ref_id) : ""))
          .filter((x: string) => x)
      )
    );

    const coCodes: string[] = Array.from(
      new Set(
        (people ?? [])
          .map((p: any) => (p.co_code ? String(p.co_code) : ""))
          .filter((x: string) => x)
      )
    );

    const companyById = new Map<string, { name: string; code: string | null }>();
    const contractorById = new Map<string, { name: string; code: string | null }>();
    const companyByCode = new Map<string, string>();
    const contractorByCode = new Map<string, string>();

    if (coRefIds.length > 0) {
      const { data: companies } = await admin.from("company").select("company_id, company_name, company_code").in("company_id", coRefIds);
      (companies ?? []).forEach((c: any) => {
        companyById.set(String(c.company_id), { name: c.company_name ?? "—", code: c.company_code ?? null });
        if (c.company_code) companyByCode.set(String(c.company_code), c.company_name ?? "—");
      });

      const { data: contractors } = await admin.from("contractor").select("contractor_id, contractor_name, contractor_code").in("contractor_id", coRefIds);
      (contractors ?? []).forEach((c: any) => {
        contractorById.set(String(c.contractor_id), { name: c.contractor_name ?? "—", code: c.contractor_code ?? null });
        if (c.contractor_code) contractorByCode.set(String(c.contractor_code), c.contractor_name ?? "—");
      });
    }

    if (coCodes.length > 0) {
      const { data: companiesByCode } = await admin.from("company").select("company_code, company_name").in("company_code", coCodes);
      (companiesByCode ?? []).forEach((c: any) => {
        if (c.company_code) companyByCode.set(String(c.company_code), c.company_name ?? "—");
      });

      const { data: contractorsByCode } = await admin
        .from("contractor")
        .select("contractor_code, contractor_name")
        .in("contractor_code", coCodes);

      (contractorsByCode ?? []).forEach((c: any) => {
        if (c.contractor_code) contractorByCode.set(String(c.contractor_code), c.contractor_name ?? "—");
      });
    }

    (people ?? []).forEach((p: any) => {
      const pid = String(p.person_id);
      const co_ref_id = p.co_ref_id ? String(p.co_ref_id) : null;
      const co_code = p.co_code ? String(p.co_code) : null;

      let affiliation_kind: "company" | "contractor" | null = null;
      let affiliation_name: string | null = null;

      if (co_ref_id && companyById.has(co_ref_id)) {
        affiliation_kind = "company";
        affiliation_name = companyById.get(co_ref_id)?.name ?? null;
      } else if (co_ref_id && contractorById.has(co_ref_id)) {
        affiliation_kind = "contractor";
        affiliation_name = contractorById.get(co_ref_id)?.name ?? null;
      } else if (co_code && companyByCode.has(co_code)) {
        affiliation_kind = "company";
        affiliation_name = companyByCode.get(co_code) ?? null;
      } else if (co_code && contractorByCode.has(co_code)) {
        affiliation_kind = "contractor";
        affiliation_name = contractorByCode.get(co_code) ?? null;
      }

      personMetaById.set(pid, { affiliation_kind, affiliation_name });
    });
  }
  // ---------- /FIX ----------

  const okRowsBanded = applyBandsToRows(okRows, rubricMap, { tnpsKey, ftrKey, toolKey });
  const nonOkRowsBanded = applyBandsToRows(nonOkRows, rubricMap, { tnpsKey, ftrKey, toolKey });

  const reportsToMap = new Map<string, string>();
  (scoped.rows ?? []).forEach((r: any) => {
    if (!r.reports_to_person_id) return;
    const id = String(r.reports_to_person_id);
    const name = personNameById.get(id) ?? "—";
    reportsToMap.set(id, name);
  });

  const reportsToOptions = Array.from(reportsToMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  if (!scoped.rows.length) {
    return (
      <PageShell>
        <ReportsClientShell
          title="Metrics"
          subtitle="Reports • one-click landing (snapshot-driven)"
          preset={activePreset}
          rubricRows={rubricRowsAll as any}
          kpis={P4P_KPIS}
          classType={classType as any}
        />

        <Card>
          <div className="flex items-center gap-4 flex-wrap">
            <FiscalSelector options={fiscalOptions} selected={selectedFiscal} />
          </div>
        </Card>

        <Card>
          <div className="text-sm font-medium">No rows in your scope</div>
          <div className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Scope mode: <span className="font-mono text-xs">{scoped.scopeLabel}</span>
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ReportsClientShell
        title="Metrics"
        subtitle={`Reports • ${classType} • Scope: ${scoped.scopeLabel}`}
        preset={activePreset}
        rubricRows={rubricRowsAll as any}
        kpis={P4P_KPIS}
        classType={classType as any}
      />

      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <FiscalSelector options={fiscalOptions} selected={selectedFiscal} />
          <ReportsFilterBar reportsToOptions={reportsToOptions} selectedReportsTo={selectedReportsTo} />
        </div>
      </Card>

      <ReportSummaryTiles
        rows={filteredRows}
        priorRows={priorRowsScoped}
        kpis={P4P_KPIS}
        preset={activePreset}
        rubricRows={rubricRowsAll as any}
        rubricKeys={{ tnpsKey, ftrKey, toolKey }}
      />

      <ReportsTabbedTable
        okRows={okRowsBanded}
        nonOkRows={nonOkRowsBanded}
        personNameById={personNameById}
        personMetaById={personMetaById as any}
        preset={activePreset}
        kpis={P4P_KPIS}
        latestMetricDate={latestMetricDate}
        priorMetricDate={priorMetricDate}
        priorSnapshotByTechId={priorByTechId as any}
      />
    </PageShell>
  );
}