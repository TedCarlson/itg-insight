import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { getLatestBatch } from "@/shared/kpis/sources/getLatestBatch";
import { getTotalRows } from "@/shared/kpis/sources/getTotalRows";
import type {
  KpiDefinitionLike,
  RawMetricPayload,
} from "@/shared/kpis/contracts/kpiTypes";
import type { KpiBandDefinition } from "@/shared/kpis/math/resolveBand";

type KpiConfigRow = {
  class_type?: string | null;
  kpi_key?: string | null;
  label?: string | null;
  enabled?: boolean | null;
  is_enabled?: boolean | null;
  active?: boolean | null;
  is_active?: boolean | null;
  show?: boolean | null;
  show_in_report?: boolean | null;
  report_order?: number | null;
  display_order?: number | null;
  sort_order?: number | null;
};

type KpiDefRow = {
  kpi_key?: string | null;
  label?: string | null;
  customer_label?: string | null;
  raw_label_identifier?: string | null;
};

type RubricRow = {
  kpi_key?: string | null;
  band_key?: string | null;
  min_value?: number | null;
  max_value?: number | null;
};

type Args = {
  pc_org_id: string;
  fiscal_end_date: string;
  summary_type?: string;
  summary_key?: string;
};

type Result = {
  definitions: KpiDefinitionLike[];
  rows: RawMetricPayload[];
  bands_by_kpi: Record<string, KpiBandDefinition[]>;
  context: {
    is_totals_row: boolean;
    is_single_row: boolean;
    is_single_fm: boolean;
  };
  support: string;
};

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_%]/g, "");
}

function isEnabledAndShown(row: KpiConfigRow): boolean {
  const enabled =
    row.enabled ?? row.is_enabled ?? row.active ?? row.is_active ?? true;
  const show = row.show_in_report ?? row.show ?? true;
  return Boolean(enabled) && Boolean(show);
}

function buildDefinitions(args: {
  classConfig: KpiConfigRow[];
  kpiDefs: KpiDefRow[];
}): KpiDefinitionLike[] {
  const defByKey = new Map<string, KpiDefRow>();

  for (const row of args.kpiDefs) {
    const key = String(row.kpi_key ?? "").trim();
    if (!key) continue;
    defByKey.set(key, row);
  }

  const techRows = args.classConfig.filter(
    (row) =>
      normalizeToken(row.class_type) === "tech" &&
      isEnabledAndShown(row)
  );

  const out: Array<KpiDefinitionLike & { _sort: number }> = [];

  for (const row of techRows) {
    const kpiKey = String(row.kpi_key ?? "").trim();
    if (!kpiKey) continue;

    const def = defByKey.get(kpiKey);

    const label =
      String(def?.customer_label ?? "").trim() ||
      String(row.label ?? "").trim() ||
      String(def?.label ?? "").trim() ||
      kpiKey;

    const sort = Number(
      row.report_order ?? row.display_order ?? row.sort_order ?? 999
    );

    out.push({
      kpi_key: kpiKey,
      label,
      customer_label: def?.customer_label
        ? String(def.customer_label).trim()
        : null,
      raw_label_identifier: def?.raw_label_identifier
        ? String(def.raw_label_identifier).trim()
        : null,
      _sort: Number.isFinite(sort) ? sort : 999,
    });
  }

  return out
    .sort((a, b) => {
      if (a._sort !== b._sort) return a._sort - b._sort;
      return String(a.label ?? a.kpi_key).localeCompare(
        String(b.label ?? b.kpi_key)
      );
    })
    .map(({ _sort, ...rest }) => rest);
}

function buildBandsByKpi(
  rubricRows: RubricRow[]
): Record<string, KpiBandDefinition[]> {
  const out: Record<string, KpiBandDefinition[]> = {};

  for (const row of rubricRows) {
    const kpiKey = String(row.kpi_key ?? "").trim();
    const bandKey = String(row.band_key ?? "").trim();

    if (!kpiKey || !bandKey) continue;

    const bucket = out[kpiKey] ?? [];
    bucket.push({
      band_key: bandKey as KpiBandDefinition["band_key"],
      min_value:
        typeof row.min_value === "number" && Number.isFinite(row.min_value)
          ? row.min_value
          : null,
      max_value:
        typeof row.max_value === "number" && Number.isFinite(row.max_value)
          ? row.max_value
          : null,
    });
    out[kpiKey] = bucket;
  }

  return out;
}

function mapTotalsToRaw(
  rows: Awaited<ReturnType<typeof getTotalRows>>
): RawMetricPayload[] {
  return rows.map((row) => row.raw);
}

export async function getBpSupervisorKpiStripData(
  args: Args
): Promise<Result> {
  const admin = supabaseAdmin();

  const [
    { data: kpiDefs },
    { data: classConfig },
    { data: rubricRows },
    latestBatch,
    totalRows,
  ] = await Promise.all([
    admin.from("metrics_kpi_def").select("*").order("kpi_key"),
    admin
      .from("metrics_class_kpi_config")
      .select("*")
      .order("class_type")
      .order("kpi_key"),
    admin
      .from("metrics_kpi_rubric")
      .select("*")
      .or("is_active.is.null,is_active.eq.true")
      .order("kpi_key")
      .order("band_key"),
    getLatestBatch({
      pc_org_id: args.pc_org_id,
      fiscal_end_date: args.fiscal_end_date,
    }),
    getTotalRows({
      pc_org_id: args.pc_org_id,
      fiscal_end_date: args.fiscal_end_date,
      summary_type: args.summary_type ?? "pc_org_total",
      summary_key: args.summary_key,
    }),
  ]);

  const definitions = buildDefinitions({
    classConfig: (classConfig ?? []) as KpiConfigRow[],
    kpiDefs: (kpiDefs ?? []) as KpiDefRow[],
  });

  const bands_by_kpi = buildBandsByKpi((rubricRows ?? []) as RubricRow[]);
  const rows = mapTotalsToRaw(totalRows ?? []);

  return {
    definitions,
    rows: rows.length > 0 ? [rows[0]] : [],
    bands_by_kpi,
    context: {
      is_totals_row: true,
      is_single_row: true,
      is_single_fm: true,
    },
    support: latestBatch
      ? `Batch ${latestBatch.batch_id.slice(0, 8)} • totals row`
      : "Totals row",
  };
}