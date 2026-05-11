// path: apps/web/src/features/admin/catalogue/components/pc-org/pcOrgDisplay.ts

import type { LookupOption } from "@/features/admin/catalogue/components/forms/PcOrgForm";
import type { PcOrgAdminRow } from "@/features/admin/catalogue/hooks/usePcOrgAdmin";

export function shortId(id: unknown) {
  if (id == null) return "—";

  const value = String(id);
  if (value.length <= 14) return value;

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function labelOrId(label: unknown, id: unknown) {
  const nextLabel = label == null ? "" : String(label).trim();
  return nextLabel ? nextLabel : shortId(id);
}

export function emptyPcOrgDraft() {
  return {
    pc_org_name: "",
    fulfillment_center_id: null,
    fulfillment_center_name: "",
    pc_id: null,
    mso_id: null,
    division_id: null,
    region_id: null,
  };
}

/**
 * Legacy fallback: Build dropdown options from currently loaded rows.
 * Primary source should be useCatalogueLookups("pc_org").
 *
 * Fulfillment Center is intentionally NOT a dropdown.
 */
export function buildOptionsFromRows(rows: PcOrgAdminRow[]) {
  const byKey = (id: unknown) => (id == null ? "" : String(id));

  const add = (
    map: Map<string, LookupOption>,
    id: unknown,
    label: unknown,
    sublabel?: unknown
  ) => {
    const key = byKey(id);
    if (!key) return;
    if (map.has(key)) return;

    const nextLabel = label == null ? "" : String(label).trim();

    map.set(key, {
      id: key,
      label: nextLabel || key,
      sublabel: sublabel == null ? undefined : String(sublabel),
    });
  };

  const pc = new Map<string, LookupOption>();
  const mso = new Map<string, LookupOption>();
  const division = new Map<string, LookupOption>();
  const region = new Map<string, LookupOption>();

  for (const row of rows) {
    const anyRow = row as any;

    const pcLabel =
      anyRow.pc_number != null
        ? `PC ${anyRow.pc_number}`
        : anyRow.pc_name ?? anyRow.pc_code ?? undefined;

    add(pc, row.pc_id, pcLabel, row.pc_id);
    add(mso, row.mso_id, anyRow.mso_name ?? anyRow.mso_label, row.mso_id);

    const divisionLabel =
      anyRow.division_name && anyRow.division_code
        ? `${anyRow.division_name} (${anyRow.division_code})`
        : anyRow.division_name ?? anyRow.division_code;

    add(division, row.division_id, divisionLabel, row.division_id);

    const regionLabel =
      anyRow.region_name && anyRow.region_code
        ? `${anyRow.region_name} (${anyRow.region_code})`
        : anyRow.region_name ?? anyRow.region_code;

    add(region, row.region_id, regionLabel, row.region_id);
  }

  const sort = (a: LookupOption, b: LookupOption) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" });

  return {
    pcOptions: Array.from(pc.values()).sort(sort),
    msoOptions: Array.from(mso.values()).sort(sort),
    divisionOptions: Array.from(division.values()).sort(sort),
    regionOptions: Array.from(region.values()).sort(sort),
  };
}