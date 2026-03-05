import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";

import type { BandKey, ScorecardResponse, ScorecardTile } from "./scorecard.types";

type Args = {
  person_id: string;
};

type KpiCfg = {
  kpi_key: string;
  label: string | null;
  enabled: boolean;
  sort: number;
};

type RubricRow = {
  kpi_key: string;
  band_key: BandKey;
  min_value: number | null;
  max_value: number | null;
  score_value: number | null;
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isActiveWindow(row: any, today: string) {
  const activeOk = row?.active === true || row?.active == null;
  const startOk = !row?.start_date || String(row.start_date) <= today;
  const endOk = !row?.end_date || String(row.end_date) >= today;
  return activeOk && startOk && endOk;
}

function pickBestTechId(assignments: any[], today: string): string | null {
  if (!assignments?.length) return null;

  const current = assignments.filter((a) => isActiveWindow(a, today) && a?.tech_id);
  const pool = current.length ? current : assignments.filter((a) => a?.tech_id);

  pool.sort((a, b) => String(b?.start_date ?? "").localeCompare(String(a?.start_date ?? "")));
  const best = pool[0]?.tech_id ? String(pool[0].tech_id).trim() : "";
  return best ? best : null;
}

function paintForBand(band: BandKey) {
  switch (band) {
    case "EXCEEDS":
      return { preset: "BAND_EXCEEDS", bg: "var(--to-surface-2)", border: "var(--to-success)", ink: null };
    case "MEETS":
      return { preset: "BAND_MEETS", bg: "var(--to-surface-2)", border: "var(--to-primary)", ink: null };
    case "NEEDS_IMPROVEMENT":
      return { preset: "BAND_NEEDS_IMPROVEMENT", bg: "var(--to-surface-2)", border: "var(--to-warning)", ink: null };
    case "MISSES":
      return { preset: "BAND_MISSES", bg: "var(--to-surface-2)", border: "var(--to-danger)", ink: null };
    default:
      return { preset: "BAND_NO_DATA", bg: "var(--to-surface-2)", border: "var(--to-border)", ink: null };
  }
}

function pickBand(value: number | null, bands: RubricRow[] | null | undefined): BandKey {
  if (value === null || value === undefined || !Number.isFinite(value)) return "NO_DATA";
  if (!bands || bands.length === 0) return "NO_DATA";

  for (const b of bands) {
    const minOk = b.min_value === null || value >= b.min_value;
    const maxOk = b.max_value === null || value <= b.max_value;
    if (minOk && maxOk) return b.band_key;
  }

  return "NO_DATA";
}

function numOrNull(x: any): number | null {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function formatValueDisplay(kpiKey: string, value: number | null): string | null {
  if (value === null) return null;

  const lower = kpiKey.toLowerCase();
  const looksLikeRate =
    lower.endsWith("_rate") || lower.endsWith("_pct") || lower.includes("rate") || lower.includes("pct");

  if (looksLikeRate) {
    const pct = value <= 1.5 ? value * 100 : value;
    return `${pct.toFixed(pct >= 10 ? 0 : 1)}%`;
  }

  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

async function loadTechKpiConfig(sbAdmin: any): Promise<KpiCfg[]> {
  const { data } = await sbAdmin
    .from("metrics_class_kpi_config")
    .select("*")
    .eq("class_type", "TECH");

  const rows = (data ?? []) as any[];

  const out: KpiCfg[] = rows
    .map((c) => {
      const kpi_key = String(c?.kpi_key ?? "").trim();
      if (!kpi_key) return null;

      const enabled =
        c.is_enabled ?? c.enabled ?? c.is_active ?? c.active ?? true;

      const show =
        c.show_in_report ?? c.show ?? true;

      if (!enabled || !show) return null;

      const label = c.label ?? null;

      const sort =
        c.sort_order ?? c.display_order ?? 999;

      return { kpi_key, label, enabled: true, sort };
    })
    .filter(Boolean) as any;

  out.sort((a, b) => a.sort - b.sort || a.kpi_key.localeCompare(b.kpi_key));
  return out;
}

async function loadRubricRows(sbAdmin: any, kpiKeys: string[]): Promise<Map<string, RubricRow[]>> {
  const { data } = await sbAdmin
    .from("metrics_kpi_rubric")
    .select("kpi_key,band_key,min_value,max_value,score_value")
    .eq("is_active", true)
    .in("kpi_key", kpiKeys);

  const m = new Map<string, RubricRow[]>();

  for (const r of (data ?? []) as any[]) {
    const k = String(r.kpi_key);

    const row: RubricRow = {
      kpi_key: k,
      band_key: r.band_key,
      min_value: r.min_value,
      max_value: r.max_value,
      score_value: r.score_value,
    };

    const arr = m.get(k) ?? [];
    arr.push(row);
    m.set(k, arr);
  }

  return m;
}

async function resolveIdentityForOrg(person_id: string, pc_org_id: string) {
  const admin = supabaseAdmin();
  const today = isoToday();

  const [pRes, asgRes] = await Promise.all([
    admin.from("person").select("person_id,full_name,emails").eq("person_id", person_id).maybeSingle(),
    admin
      .from("assignment")
      .select("tech_id,start_date,end_date,active")
      .eq("pc_org_id", pc_org_id)
      .eq("person_id", person_id),
  ]);

  const full_name = pRes?.data?.full_name ?? null;
  const emails = pRes?.data?.emails ?? null;

  const tech_id = pickBestTechId((asgRes.data ?? []) as any[], today);

  return { full_name, emails, tech_id };
}

export async function getTechScorecardPayload(args: Args): Promise<ScorecardResponse> {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) throw new Error("No org selected");

  const sb = await supabaseServer();
  const admin = supabaseAdmin();

  const pc_org_id = scope.selected_pc_org_id;

  const ident = await resolveIdentityForOrg(args.person_id, pc_org_id);

  if (!ident.tech_id) throw new Error("No tech assignment");

  const kpiCfg = await loadTechKpiConfig(admin);
  const kpiKeys = kpiCfg.map((k) => k.kpi_key);
  const rubricByKpi = await loadRubricRows(admin, kpiKeys);

  const { data: fact } = await sb
    .from("metrics_tech_fact_day")
    .select("*")
    .eq("pc_org_id", pc_org_id)
    .eq("tech_id", ident.tech_id)
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tiles: ScorecardTile[] = kpiCfg.map((k) => {
    const v = numOrNull((fact as any)?.[k.kpi_key]);

    const band_key = pickBand(v, rubricByKpi.get(k.kpi_key));

    return {
      kpi_key: k.kpi_key,
      label: k.label ?? k.kpi_key,
      value: v,
      value_display: formatValueDisplay(k.kpi_key, v),
      band: {
        band_key,
        label: band_key.replaceAll("_", " "),
        paint: paintForBand(band_key),
      },
      momentum: {
        state: "NO_DATA",
        delta: null,
        delta_display: null,
        arrow: null,
        windows: { short_days: 7, long_days: 30 },
        notes: null,
      },
      context: null,
      drill: {
        trend_ranges: [30, 60, 90],
        default_range: 30,
      },
    };
  });

  return {
    header: {
      person_id: args.person_id,
      full_name: ident.full_name,
      affiliation: null,
      supervisor_name: null,
      tech_id: ident.tech_id,
      pc_org_name: null,
      fiscal_month_key: "—",
      fiscal_start_date: "—",
      fiscal_end_date: fact?.fiscal_end_date ?? "—",
    },
    org_selector: [
      {
        pc_org_id,
        label: "Selected Org",
        tech_id: ident.tech_id,
        is_selected: true,
      },
    ],
    tiles,
    rank: null,
  };
}