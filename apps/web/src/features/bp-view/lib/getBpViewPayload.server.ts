import { bootstrapProfileServer } from "@/lib/auth/bootstrapProfile.server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import type { BandKey } from "@/features/metrics/scorecard/lib/scorecard.types";
import type {
  BpViewKpiItem,
  BpViewPayload,
  BpViewRiskItem,
  BpViewRosterMetricCell,
  BpViewRosterRow,
} from "./bpView.types";

type RangeKey = "FM" | "3FM" | "12FM";

type Args = {
  range: RangeKey;
};

type KpiCfg = {
  kpi_key: string;
  label: string;
  sort: number;
};

type RubricRow = {
  kpi_key: string;
  band_key: BandKey;
  min_value: number | null;
  max_value: number | null;
};

type AssignmentRow = {
  person_id: string | null;
  pc_org_id: string | null;
  tech_id: string | null;
  position_title: string | null;
  active: boolean | null;
};

type PersonRow = {
  person_id: string;
  full_name: string | null;
};

type FactRow = {
  tech_id: string | null;
  metric_date: string | null;
  fiscal_end_date: string | null;
  [key: string]: unknown;
};

function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function bandPaintLabel(band: BandKey) {
  switch (band) {
    case "EXCEEDS":
      return "Exceeds";
    case "MEETS":
      return "Meets";
    case "NEEDS_IMPROVEMENT":
      return "Needs Improvement";
    case "MISSES":
      return "Misses";
    default:
      return "No Data";
  }
}

function pickBand(value: number | null, bands: RubricRow[] | undefined): BandKey {
  if (value == null || !bands?.length) return "NO_DATA";

  for (const b of bands) {
    const minOk = b.min_value == null || value >= b.min_value;
    const maxOk = b.max_value == null || value <= b.max_value;
    if (minOk && maxOk) return b.band_key;
  }

  return "NO_DATA";
}

function formatValueDisplay(kpiKey: string, value: number | null): string | null {
  if (value == null) return null;

  const lower = kpiKey.toLowerCase();
  const looksLikeRate =
    lower.endsWith("_rate") ||
    lower.endsWith("_pct") ||
    lower.includes("rate") ||
    lower.includes("pct") ||
    lower.includes("usage") ||
    lower.includes("pass") ||
    lower.includes("met");

  if (looksLikeRate) {
    const pct = value <= 1.5 ? value * 100 : value;
    return `${pct.toFixed(pct >= 10 ? 1 : 2)}%`;
  }

  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

async function loadPcOrgLabel(pc_org_id: string): Promise<string> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("pc_org")
    .select("pc_org_id,pc_org_name")
    .eq("pc_org_id", pc_org_id)
    .maybeSingle();

  return data?.pc_org_name ? String(data.pc_org_name) : pc_org_id;
}

async function loadP4pConfig(admin: ReturnType<typeof supabaseAdmin>): Promise<KpiCfg[]> {
  const [{ data: classRows }, { data: defRows }] = await Promise.all([
    admin.from("metrics_class_kpi_config").select("*").eq("class_type", "P4P"),
    admin.from("metrics_kpi_def").select("kpi_key,customer_label,label"),
  ]);

  const defByKey = new Map<string, { customer_label?: string | null; label?: string | null }>();
  for (const row of (defRows ?? []) as any[]) {
    const k = String(row?.kpi_key ?? "").trim();
    if (k) defByKey.set(k, row);
  }

  const out: KpiCfg[] = [];

  for (const row of (classRows ?? []) as any[]) {
    const kpi_key = String(row?.kpi_key ?? "").trim();
    if (!kpi_key) continue;

    const enabled = row.is_enabled ?? row.enabled ?? row.is_active ?? row.active ?? true;
    const show = row.show_in_report ?? row.show ?? true;
    if (!enabled || !show) continue;

    const def = defByKey.get(kpi_key);
    const label =
      (row?.label && String(row.label).trim()) ||
      (def?.customer_label && String(def.customer_label).trim()) ||
      (def?.label && String(def.label).trim()) ||
      kpi_key;

    const sort = row.sort_order ?? row.display_order ?? row.report_order ?? 999;

    out.push({
      kpi_key,
      label: String(label),
      sort: Number(sort),
    });
  }

  out.sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  return out;
}

async function loadRubrics(
  admin: ReturnType<typeof supabaseAdmin>,
  kpiKeys: string[]
): Promise<Map<string, RubricRow[]>> {
  const out = new Map<string, RubricRow[]>();
  if (!kpiKeys.length) return out;

  const { data } = await admin
    .from("metrics_kpi_rubric")
    .select("kpi_key,band_key,min_value,max_value")
    .eq("is_active", true)
    .in("kpi_key", kpiKeys);

  for (const row of (data ?? []) as any[]) {
    const key = String(row.kpi_key);
    const arr = out.get(key) ?? [];
    arr.push({
      kpi_key: key,
      band_key: row.band_key,
      min_value: row.min_value,
      max_value: row.max_value,
    });
    out.set(key, arr);
  }

  return out;
}

function monthsBack(range: RangeKey) {
  if (range === "12FM") return 12;
  if (range === "3FM") return 3;
  return 1;
}

function monthWindowStart(range: RangeKey) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  start.setUTCMonth(start.getUTCMonth() - (monthsBack(range) - 1));
  return start.toISOString().slice(0, 10);
}

function resolveRoleLabel(assignments: AssignmentRow[]): string {
  const titles = new Set(
    assignments
      .map((a) => (a.position_title ? String(a.position_title).trim() : null))
      .filter((v): v is string => !!v)
  );

  if (titles.has("BP Owner")) return "BP Owner";
  if (titles.has("BP Supervisor")) return "BP Supervisor";
  if (titles.has("Technician")) return "Technician";
  return "BP View";
}

function latestFactByTech(rows: FactRow[]): Map<string, FactRow> {
  const out = new Map<string, FactRow>();

  for (const row of rows) {
    const tech_id = row.tech_id ? String(row.tech_id) : null;
    if (!tech_id) continue;

    const current = out.get(tech_id);
    if (!current) {
      out.set(tech_id, row);
      continue;
    }

    const currentDate = String(current.metric_date ?? "");
    const nextDate = String(row.metric_date ?? "");
    if (nextDate > currentDate) out.set(tech_id, row);
  }

  return out;
}

function buildRosterMetricCells(args: {
  fact: FactRow | null;
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
}): BpViewRosterMetricCell[] {
  return args.kpis.map((kpi) => {
    const value = args.fact ? numOrNull(args.fact[kpi.kpi_key]) : null;
    const band_key = pickBand(value, args.rubricByKpi.get(kpi.kpi_key));

    return {
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      value,
      value_display: formatValueDisplay(kpi.kpi_key, value),
      band_key,
    };
  });
}

function buildKpiStrip(args: {
  rosterRows: BpViewRosterRow[];
  kpis: KpiCfg[];
  rubricByKpi: Map<string, RubricRow[]>;
}): BpViewKpiItem[] {
  return args.kpis.map((kpi) => {
    const values = args.rosterRows
      .map((row) => row.metrics.find((m) => m.kpi_key === kpi.kpi_key)?.value ?? null)
      .filter((v): v is number => v != null);

    const avg =
      values.length > 0
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : null;

    const band_key = pickBand(avg, args.rubricByKpi.get(kpi.kpi_key));

    return {
      kpi_key: kpi.kpi_key,
      label: kpi.label,
      value: avg,
      value_display: formatValueDisplay(kpi.kpi_key, avg),
      band_key,
      band_label: bandPaintLabel(band_key),
      support: `${args.rosterRows.length} techs in scope`,
    };
  });
}

function buildRiskStrip(rosterRows: BpViewRosterRow[], kpis: KpiCfg[]): BpViewRiskItem[] {
  const belowThresholdCount = rosterRows.filter((r) => r.below_target_count >= 2).length;

  const kpiConcernCounts = new Map<string, number>();
  for (const kpi of kpis) kpiConcernCounts.set(kpi.kpi_key, 0);

  for (const row of rosterRows) {
    for (const metric of row.metrics) {
      if (metric.band_key === "NEEDS_IMPROVEMENT" || metric.band_key === "MISSES") {
        kpiConcernCounts.set(metric.kpi_key, (kpiConcernCounts.get(metric.kpi_key) ?? 0) + 1);
      }
    }
  }

  const topConcern = [...kpiConcernCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topConcernLabel = topConcern?.[0] ?? "—";
  const topConcernCount = topConcern?.[1] ?? 0;

  const coachingQueue = rosterRows.filter((r) => r.below_target_count >= 1).length;

  const strongestTech =
    [...rosterRows]
      .sort((a, b) => a.below_target_count - b.below_target_count || a.full_name.localeCompare(b.full_name))[0]
      ?.full_name ?? "—";

  return [
    {
      title: "Below Threshold",
      value: String(belowThresholdCount),
      note: "Techs below target on 2+ KPIs",
    },
    {
      title: "Coaching Queue",
      value: String(coachingQueue),
      note: "Techs with at least 1 KPI needing attention",
    },
    {
      title: "Top Concern",
      value: topConcernLabel,
      note: `${topConcernCount} tech KPI flags in scope`,
    },
    {
      title: "Strongest Standing",
      value: strongestTech,
      note: "Lowest current risk footprint",
    },
  ];
}

export async function getBpViewPayload(args: Args): Promise<BpViewPayload> {
  const [boot, scope] = await Promise.all([
    bootstrapProfileServer(),
    requireSelectedPcOrgServer(),
  ]);

  if (!boot.ok || !boot.person_id) {
    throw new Error("No linked person profile");
  }

  if (!scope.ok) {
    throw new Error("No org selected");
  }

  const admin = supabaseAdmin();
  const selected_pc_org_id = scope.selected_pc_org_id;

  const [orgLabel, p4pConfig] = await Promise.all([
    loadPcOrgLabel(selected_pc_org_id),
    loadP4pConfig(admin),
  ]);

  const rubricByKpi = await loadRubrics(
    admin,
    p4pConfig.map((k) => k.kpi_key)
  );

  const { data: myAssignmentsData } = await admin
    .from("assignment_admin_v")
    .select("person_id,pc_org_id,tech_id,position_title,active")
    .eq("person_id", boot.person_id)
    .eq("pc_org_id", selected_pc_org_id)
    .eq("active", true);

  const myAssignments = (myAssignmentsData ?? []) as AssignmentRow[];
  const role_label = resolveRoleLabel(myAssignments);

  const { data: techAssignmentsData } = await admin
    .from("assignment_admin_v")
    .select("person_id,pc_org_id,tech_id,position_title,active")
    .eq("pc_org_id", selected_pc_org_id)
    .eq("active", true)
    .not("tech_id", "is", null);

  const techAssignments = (techAssignmentsData ?? []) as AssignmentRow[];

  const uniqueByTech = new Map<string, AssignmentRow>();
  for (const row of techAssignments) {
    const tech_id = row.tech_id ? String(row.tech_id) : null;
    if (!tech_id) continue;
    if (!uniqueByTech.has(tech_id)) uniqueByTech.set(tech_id, row);
  }

  const scopedAssignments = [...uniqueByTech.values()];
  const personIds = Array.from(
    new Set(scopedAssignments.map((r) => String(r.person_id ?? "")).filter(Boolean))
  );
  const techIds = Array.from(
    new Set(scopedAssignments.map((r) => String(r.tech_id ?? "")).filter(Boolean))
  );

  const [personRes, factRes] = await Promise.all([
    personIds.length
      ? admin.from("person").select("person_id,full_name").in("person_id", personIds)
      : Promise.resolve({ data: [] as PersonRow[] }),
    techIds.length
      ? admin
          .from("metrics_tech_fact_day")
          .select("*")
          .eq("pc_org_id", selected_pc_org_id)
          .gte("fiscal_end_date", monthWindowStart(args.range))
          .in("tech_id", techIds)
          .order("metric_date", { ascending: false })
      : Promise.resolve({ data: [] as FactRow[] }),
  ]);

  const peopleById = new Map<string, PersonRow>();
  for (const row of ((personRes.data ?? []) as PersonRow[])) {
    peopleById.set(String(row.person_id), row);
  }

  const factByTech = latestFactByTech((factRes.data ?? []) as FactRow[]);

  const roster_rows: BpViewRosterRow[] = scopedAssignments
    .map((assignment) => {
      const person_id = String(assignment.person_id ?? "");
      const tech_id = String(assignment.tech_id ?? "");
      const person = peopleById.get(person_id);
      const fact = factByTech.get(tech_id) ?? null;
      const metrics = buildRosterMetricCells({
        fact,
        kpis: p4pConfig,
        rubricByKpi,
      });

      const below_target_count = metrics.filter(
        (m) => m.band_key === "NEEDS_IMPROVEMENT" || m.band_key === "MISSES"
      ).length;

      return {
        person_id,
        tech_id,
        full_name: person?.full_name ? String(person.full_name) : `Tech ${tech_id}`,
        context: `Tech ID ${tech_id} • ${orgLabel}`,
        metrics,
        below_target_count,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const kpi_strip = buildKpiStrip({
    rosterRows: roster_rows,
    kpis: p4pConfig,
    rubricByKpi,
  });

  const risk_strip = buildRiskStrip(roster_rows, p4pConfig);

  return {
    header: {
      role_label,
      scope_label: "Resolved Org",
      org_label: orgLabel,
      org_count: 1,
      range_label: args.range,
      as_of_date: isoToday(),
    },
    kpi_strip,
    risk_strip,
    roster_columns: p4pConfig.map((k) => ({
      kpi_key: k.kpi_key,
      label: k.label,
    })),
    roster_rows,
  };
}