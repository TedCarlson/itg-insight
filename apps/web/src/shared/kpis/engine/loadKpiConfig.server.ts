import { supabaseAdmin } from "@/shared/data/supabase/admin";

export type LoadedKpiConfigItem = {
  kpi_key: string;
  label: string;
  customer_label: string | null;
  raw_label_identifier: string | null;
  direction: string | null;
  sort_order: number;
};

type KpiConfigRow = {
  class_type?: string | null;
  kpi_key?: string | null;
  label?: string | null;
  sort_order?: number | null;
  display_order?: number | null;
  report_order?: number | null;
  is_enabled?: boolean | null;
  enabled?: boolean | null;
  is_active?: boolean | null;
  active?: boolean | null;
  show_in_report?: boolean | null;
  show?: boolean | null;
};

type KpiDefRow = {
  kpi_key?: string | null;
  label?: string | null;
  customer_label?: string | null;
  raw_label_identifier?: string | null;
  direction?: string | null;
};

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_%]/g, "");
}

function isEnabledAndShown(row: KpiConfigRow): boolean {
  const enabled =
    row.is_enabled ?? row.enabled ?? row.is_active ?? row.active ?? true;
  const show = row.show_in_report ?? row.show ?? true;
  return Boolean(enabled) && Boolean(show);
}

export async function loadKpiConfig(args: {
  class_type: string;
}): Promise<LoadedKpiConfigItem[]> {
  const admin = supabaseAdmin();

  const [{ data: classRows }, { data: defRows }] = await Promise.all([
    admin.from("metrics_class_kpi_config").select("*"),
    admin
      .from("metrics_kpi_def")
      .select("kpi_key,label,customer_label,raw_label_identifier,direction"),
  ]);

  const requestedClass = normalizeToken(args.class_type);

  const filteredClassRows = ((classRows ?? []) as KpiConfigRow[]).filter(
    (row) =>
      normalizeToken(row.class_type) === requestedClass && isEnabledAndShown(row)
  );

  const defByKey = new Map<string, KpiDefRow>();

  for (const row of (defRows ?? []) as KpiDefRow[]) {
    const key = String(row.kpi_key ?? "").trim();
    if (!key) continue;
    defByKey.set(key, row);
  }

  const out: Array<LoadedKpiConfigItem & { _stable_index: number }> = [];

  filteredClassRows.forEach((row, index) => {
    const kpi_key = String(row.kpi_key ?? "").trim();
    if (!kpi_key) return;

    const def = defByKey.get(kpi_key);

    const label =
      String(def?.customer_label ?? "").trim() ||
      String(row.label ?? "").trim() ||
      String(def?.label ?? "").trim() ||
      kpi_key;

    const sort_order = Number(
      row.sort_order ?? row.display_order ?? row.report_order ?? 999
    );

    out.push({
      kpi_key,
      label,
      customer_label: def?.customer_label
        ? String(def.customer_label).trim()
        : null,
      raw_label_identifier: def?.raw_label_identifier
        ? String(def.raw_label_identifier).trim()
        : null,
      direction: def?.direction ? String(def.direction).trim() : null,
      sort_order: Number.isFinite(sort_order) ? sort_order : 999,
      _stable_index: index,
    });
  });

  return out
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a._stable_index - b._stable_index;
    })
    .map(({ _stable_index, ...rest }) => rest);
}