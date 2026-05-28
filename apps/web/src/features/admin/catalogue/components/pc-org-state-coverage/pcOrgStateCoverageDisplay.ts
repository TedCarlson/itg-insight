import type { LookupOption } from "@/features/admin/catalogue/components/forms/PcOrgStateCoverageForm";

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

export async function fetchPcOrgLookup(): Promise<LookupOption[]> {
  const params = new URLSearchParams();
  params.set("pageIndex", "0");
  params.set("pageSize", "500");

  const res = await fetch(`/api/admin/catalogue/pc_org?${params.toString()}`);
  const json = (await res.json()) as { rows?: any[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Failed to load PC-ORG lookups");

  return (json.rows ?? [])
    .map((row) => ({
      id: String(row.pc_org_id),
      label: String(row.pc_org_name ?? row.pc_org_id),
      sublabel: String(row.pc_org_id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export async function fetchStateLookup(): Promise<LookupOption[]> {
  const res = await fetch("/api/admin/catalogue/pc_org_state_coverage/states");
  const json = (await res.json()) as { rows?: any[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Failed to load state lookups");

  return (json.rows ?? [])
    .map((row) => ({
      id: String(row.state_code),
      label: `${String(row.state_code)} — ${String(row.state_name ?? row.state_code)}`,
      sublabel: String(row.state_code),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
