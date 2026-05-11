// path: apps/web/src/features/admin/catalogue/components/pc-org-office/pcOrgOfficeDisplay.ts

import type { LookupOption } from "@/features/admin/catalogue/components/forms/PcOrgOfficeForm";

export function shortId(id: unknown) {
  if (id == null) return "—";

  const value = String(id);
  if (value.length <= 14) return value;

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function labelOrId(label: unknown, id: unknown) {
  const value = label == null ? "" : String(label).trim();

  return value ? value : shortId(id);
}

export async function fetchLookup(
  table: "pc_org" | "office"
): Promise<LookupOption[]> {
  const params = new URLSearchParams();
  params.set("pageIndex", "0");
  params.set("pageSize", "500");

  const res = await fetch(`/api/admin/catalogue/${table}?${params.toString()}`);
  const json = (await res.json()) as { rows?: any[]; error?: string };

  if (!res.ok) {
    throw new Error(json.error ?? `Failed to load ${table} lookups`);
  }

  const rows = json.rows ?? [];

  if (table === "pc_org") {
    return rows
      .map((row) => ({
        id: String(row.pc_org_id),
        label: String(row.pc_org_name ?? row.pc_org_id),
        sublabel: String(row.pc_org_id),
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
      );
  }

  return rows
    .map((row) => {
      const name =
        row.office_name ?? row.office_label ?? row.office_code ?? row.office_id;
      const code = row.office_code ? `(${row.office_code})` : "";

      return {
        id: String(row.office_id),
        label: `${String(name)}${code ? " " + code : ""}`,
        sublabel: String(row.office_id),
      };
    })
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
}